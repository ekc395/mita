-- ============================================================================
-- Fix: the activity feed leaked recommendations that the recommendations table
-- itself keeps private.
--
-- recommendations_select (0001) restricts a recommendation to the two people
-- involved: `auth.uid() in (from_user, to_user)`. But recommendations_activity
-- mirrors every insert into public.activity with target_user = to_user, and
-- activity_select gated visibility on can_view_user(user_id) alone -- the
-- *sender's* visibility, never the recipient's.
--
-- can_view_user() admits any public profile, so the mirrored row was readable
-- by any signed-in stranger: "X recommended <anime> to Z", including Z's id.
-- Nothing stopped it being manufactured either, since recommendations_insert
-- only requires from_user = auth.uid() -- no follow or other prior link to the
-- recipient is needed.
--
-- The fix keeps the feed useful rather than dropping the activity type: sender
-- and recipient still see the row, everyone else stops seeing it. Recipients
-- remain subject to the outer can_view_user() check, so this narrows access and
-- never widens it. The other three activity types are untouched -- 'followed'
-- is not an analogous leak because follows_select is `using (true)` and the
-- follow graph is public by design.
--
-- Residual exposure, unchanged by this migration: log_activity() is still
-- callable directly over the Data API (see 0002), so a client can forge a
-- 'recommended' row with no matching recommendations row. With this policy in
-- place such a row is visible only to its author and the named target, but
-- closing it properly still means moving log_activity() out of `public`.
-- ============================================================================

drop policy activity_select on public.activity;

create policy activity_select on public.activity
  for select to authenticated
  using (
    public.can_view_user(activity.user_id)
    and (
      activity.type <> 'recommended'
      or (select auth.uid()) in (activity.user_id, activity.target_user)
    )
  );
