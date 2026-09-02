-- ============================================================================
-- Fix: anyone could recommend anything to anyone, and the inbox now shows it.
--
-- recommendations_insert (0001) checks only `from_user = auth.uid()`. No follow,
-- no prior link -- 0004's own comment says as much. That was latent while
-- nothing read the table, but the inbox on /recs surfaces those rows to the
-- recipient, so a signed-in stranger could push arbitrary free text into
-- someone's page. RecommendButton only offers people the sender follows, but
-- that is a UI affordance, not a rule: the Data API accepts any to_user.
--
-- The product decision was "you may recommend to people you follow", so enforce
-- it where every other rule in this schema lives. Direction matters:
-- follower_id = the sender, following_id = the recipient. Unfollowing later does
-- not retract an existing recommendation; the check is at insert time only.
--
-- `note` also had no length bound, unlike profiles.display_name (<= 50) and
-- profiles.bio (<= 300). A single insert could store a multi-megabyte note that
-- then ships in the recipient's server-rendered payload on every load. 300
-- matches bio.
--
-- The table has no rows yet, so neither change can fail on existing data.
-- ============================================================================

drop policy recommendations_insert on public.recommendations;

create policy recommendations_insert on public.recommendations
  for insert to authenticated
  with check (
    from_user = (select auth.uid())
    and exists (
      select 1
        from public.follows
       where follows.follower_id = from_user
         and follows.following_id = to_user
    )
  );

alter table public.recommendations
  add constraint recommendations_note_len
  check (note is null or char_length(note) <= 300);
