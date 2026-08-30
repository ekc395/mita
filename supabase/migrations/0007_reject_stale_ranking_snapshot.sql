-- ============================================================================
-- Fix: a ranking submitted against a stale bucket lands in the wrong slot.
--
-- /log/[id] renders the viewer's bucket once, and RankingWizard's binary search
-- produces an ordinal *against that list*. set_anime_rank re-reads the bucket
-- live and clamps the index into range, which protects rank_position integrity
-- but not meaning: if the bucket changed in between, the index is silently
-- reinterpreted against a different list.
--
--   * Grew: the title lands above entries it was never compared with.
--   * Shrank: the index clamps down, derived from titles now gone.
--   * Reordered at the same size: no clamp fires at all and the title lands
--     between different neighbours -- the worst case, and one a size-only
--     check would miss.
--
-- 0005's advisory lock does not help: it serialises concurrent writes, but the
-- stale read happened during an earlier request (the page render), before any
-- lock existed to take.
--
-- So the client sends the bucket it actually compared against and this function
-- rejects the write if the live one differs. Postgres array equality is
-- element-wise and order-sensitive, which is what catches the reorder case.
--
-- p_expected cannot be added with create or replace, which cannot alter a
-- signature: that leaves the unchecked 3-argument version callable with its
-- grant intact. Dropped instead, and EXECUTE re-granted below -- drop/create
-- does not carry grants across, which is what broke every write in 0002.
--
-- Callers must pass the bucket *excluding* the title being ranked, matching
-- what /log/[id] builds. The check sits after that title is pulled out, so both
-- sides compare the same thing.
-- ============================================================================

drop function public.set_anime_rank(integer, public.sentiment, integer);

create function public.set_anime_rank(
  p_anilist_id   integer,
  p_sentiment    public.sentiment,
  p_bucket_index integer,
  p_expected     integer[]
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

  -- Here because the title has just been removed above, matching the list the
  -- client sent. coalesce is load-bearing: array_agg over zero rows returns
  -- null, which would reject every first-title-in-a-bucket write.
  if p_expected is distinct from (
    select coalesce(array_agg(ua.anilist_id order by ua.rank_position), '{}')
      from public.user_anime ua
     where ua.user_id = uid and ua.sentiment = p_sentiment
  ) then
    raise exception 'set_anime_rank: the ranking changed since this page loaded'
      using errcode = 'P0002';
  end if;

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

-- drop/create does not carry the grant across; without this every ranking write
-- fails with "permission denied for function set_anime_rank" (see 0002).
grant execute on function
  public.set_anime_rank(integer, public.sentiment, integer, integer[])
  to authenticated;
