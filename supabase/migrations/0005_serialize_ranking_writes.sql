-- ============================================================================
-- Fix: concurrent ranking writes for one user interleave badly.
--
-- set_anime_rank, set_anime_status and remove_anime all read counts, shift
-- rank_position across many rows, then recompute. Nothing serialised them, so
-- two calls from the same user -- two tabs, a retry racing the original, a
-- double-fired click -- could interleave three ways:
--
--   1. Duplicate feed rows. set_anime_rank reads v_was_ranked at the top and
--      logs at the bottom; under READ COMMITTED a second call could take that
--      read before the first committed, see "not ranked yet" too, and log a
--      second 'ranked' activity for one title.
--   2. Deadlock. Both calls mass-UPDATE the same user's rows (the shift, then
--      recompute_user_ranking); overlapping row locks taken in opposite orders
--      abort one transaction with deadlock_detected, surfacing a raw Postgres
--      error in the UI.
--   3. A stale slot. v_bucket_size and v_offset come from a snapshot taken
--      before the other call committed, so the title can land a position off
--      from what the user's comparisons actually said.
--
-- A transaction-scoped advisory lock keyed on the user fixes all three. It is
-- taken before the v_was_ranked read, which is what closes (1): READ COMMITTED
-- re-snapshots per statement, so once the lock is released the next read sees
-- the other call's committed state.
--
-- The key is hashtext(uid::text), so two different users can collide and
-- serialise against each other. That costs a short wait and nothing else --
-- these functions hold the lock only for their own transaction.
--
-- recompute_user_ranking() is deliberately left alone: it is only ever called
-- from inside these three, which already hold the lock, and advisory locks are
-- re-entrant within a transaction.
--
-- Bodies are otherwise copied verbatim from 0001 -- Postgres has no way to add
-- a statement to an existing function, so the whole definition is restated.
-- create or replace keeps the same pg_proc entry, so existing grants survive.
-- ============================================================================

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

    perform public.log_activity(uid, 'ranked', p_anilist_id, null, v_final_score);
  end if;

  return query
    select ua.*
      from public.user_anime ua
     where ua.user_id = uid
       and ua.sentiment is not null
     order by ua.rank_position;
end;
$$;

create or replace function public.set_anime_status(
  p_anilist_id integer,
  p_status     public.anime_status
)
returns public.user_anime
language plpgsql
set search_path = public
as $$
declare
  uid   uuid := (select auth.uid());
  v_row public.user_anime;
begin
  if uid is null then
    raise exception 'set_anime_status: no authenticated user';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  insert into public.user_anime (user_id, anilist_id, status)
  values (uid, p_anilist_id, p_status)
  on conflict (user_id, anilist_id) do update
     set status        = excluded.status,
         sentiment     = case when excluded.status = 'watched'
                              then user_anime.sentiment else null end,
         rank_position = case when excluded.status = 'watched'
                              then user_anime.rank_position else null end,
         score         = case when excluded.status = 'watched'
                              then user_anime.score else null end;

  perform public.recompute_user_ranking();

  select ua.* into v_row
    from public.user_anime ua
   where ua.user_id = uid and ua.anilist_id = p_anilist_id;

  return v_row;
end;
$$;

create or replace function public.remove_anime(p_anilist_id integer)
returns void
language plpgsql
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'remove_anime: no authenticated user';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  delete from public.user_anime
   where user_id = uid and anilist_id = p_anilist_id;

  perform public.recompute_user_ranking();
end;
$$;
