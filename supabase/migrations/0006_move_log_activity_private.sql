-- ============================================================================
-- Fix: log_activity() is reachable over the Data API, so a client can forge
-- feed rows.
--
-- 0001 tried to keep this definer-rights function off the RPC surface by
-- revoking EXECUTE. That broke every activity write (0002), because all four
-- callers are SECURITY INVOKER and so invoke it *as* `authenticated`; 0002
-- granted EXECUTE back and documented the real fix, which is this migration.
--
-- The residual hole 0002 and 0004 both describe: log_activity raises unless
-- p_user_id = auth.uid(), so a client cannot write rows for someone else -- but
-- it can fabricate rows for *itself* with a shape no real action produces. A
-- 'recommended' row with no matching recommendations row, or a 'ranked' row
-- carrying any score it likes, both pass.
--
-- PostgREST serves only the schemas on the API "Exposed schemas" list, which is
-- `public` (plus graphql_public) and does not include `private`. Moving the
-- function there removes it from the RPC surface while leaving it callable from
-- inside the four SECURITY INVOKER callers, which still need EXECUTE.
--
-- ALTER FUNCTION ... SET SCHEMA keeps the same pg_proc entry, so the body and
-- its existing grants move with it unchanged. The four callers must be restated
-- only because each names the function schema-qualified; every body below is
-- copied verbatim from its current definition (set_anime_rank from 0005, the
-- three triggers from 0001) with the single call site rewritten.
--
-- IMPORTANT for anything added later: a new function that writes the feed must
-- call private.log_activity and must NOT be created in `public` if it is meant
-- to be internal. Re-exposing this function re-opens the hole.
-- ============================================================================

create schema if not exists private;

-- The schema is not on the exposed list, but deny by default regardless.
revoke all on schema private from public;
revoke all on schema private from anon;

-- The four callers below are SECURITY INVOKER, so they reach log_activity as
-- `authenticated`; without USAGE here every ranking, want and follow write fails
-- exactly as it did before 0002.
grant usage on schema private to authenticated;

alter function public.log_activity(uuid, public.activity_type, integer, uuid, numeric)
  set schema private;

-- Grants travel with the function, so this only restates intent. anon never had
-- it and must not gain it.
revoke execute on function
  private.log_activity(uuid, public.activity_type, integer, uuid, numeric)
  from public, anon;
grant execute on function
  private.log_activity(uuid, public.activity_type, integer, uuid, numeric)
  to authenticated;


-- ---------------------------------------------------------------------------
-- Callers, restated with the relocated call site. Bodies otherwise verbatim.
-- ---------------------------------------------------------------------------

create or replace function public.set_anime_rank(
  p_anilist_id   integer,
  p_sentiment    public.sentiment,
  p_bucket_index integer
)
returns setof public.user_anime
language plpgsql
set search_path = public
as $$
declare
  uid            uuid := (select auth.uid());
  v_was_ranked   boolean := false;
  v_bucket_size  integer;
  v_offset       integer;
  v_index        integer;
  v_target       integer;
  v_final_score  numeric(3,1);
begin
  if uid is null then
    raise exception 'set_anime_rank: no authenticated user';
  end if;

  -- Before the v_was_ranked read below, so a concurrent call cannot also see
  -- "not ranked yet" and log a second feed item.
  perform pg_advisory_xact_lock(hashtext(uid::text));

  -- Was this title already ranked? Decides whether the feed gets a new item.
  select (ua.sentiment is not null)
    into v_was_ranked
    from public.user_anime ua
   where ua.user_id = uid and ua.anilist_id = p_anilist_id;

  -- Re-ranking: pull the title out first, then close the gap, so the bucket
  -- counts and the shift arithmetic below run against a contiguous list.
  update public.user_anime
     set sentiment = null, rank_position = null, score = null
   where user_id = uid and anilist_id = p_anilist_id;

  perform public.recompute_user_ranking();

  select count(*) into v_bucket_size
    from public.user_anime
   where user_id = uid and sentiment = p_sentiment;

  select count(*) into v_offset
    from public.user_anime
   where user_id = uid
     and sentiment is not null
     and public.sentiment_order(sentiment) < public.sentiment_order(p_sentiment);

  v_index  := least(greatest(coalesce(p_bucket_index, 1), 1), v_bucket_size + 1);
  v_target := v_offset + v_index;

  update public.user_anime
     set rank_position = rank_position + 1
   where user_id = uid
     and rank_position >= v_target;

  -- score is a placeholder: the ranked-row check constraint requires it to be
  -- non-null, CHECK constraints cannot be deferred, and recompute below
  -- immediately overwrites it with the derived value.
  insert into public.user_anime
    (user_id, anilist_id, status, sentiment, rank_position, score)
  values
    (uid, p_anilist_id, 'watched', p_sentiment, v_target, 0)
  on conflict (user_id, anilist_id) do update
     set status        = 'watched',
         sentiment     = excluded.sentiment,
         rank_position = excluded.rank_position,
         score         = excluded.score;

  perform public.recompute_user_ranking();

  -- Log the feed item only for a first-time ranking, and only after the score
  -- is final, so the activity snapshot is the real derived score.
  if not coalesce(v_was_ranked, false) then
    select ua.score into v_final_score
      from public.user_anime ua
     where ua.user_id = uid and ua.anilist_id = p_anilist_id;

    perform private.log_activity(uid, 'ranked', p_anilist_id, null, v_final_score);
  end if;

  return query
    select ua.*
      from public.user_anime ua
     where ua.user_id = uid
       and ua.sentiment is not null
     order by ua.rank_position;
end;
$$;

create or replace function public.log_want_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform private.log_activity(new.user_id, 'want', new.anilist_id, null, null);
  return null;
end;
$$;

create or replace function public.log_follow_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform private.log_activity(new.follower_id, 'followed', null, new.following_id, null);
  return null;
end;
$$;

create or replace function public.log_recommendation_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform private.log_activity(new.from_user, 'recommended', new.anilist_id, new.to_user, null);
  return null;
end;
$$;
