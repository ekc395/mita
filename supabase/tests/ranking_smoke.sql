-- ============================================================================
-- Ranking + RLS smoke test.
--
-- Run it either way:
--   * Supabase dashboard -> SQL Editor -> paste this whole file -> Run
--   * psql "$DB_URL" -f supabase/tests/ranking_smoke.sql
--
-- Deliberately free of psql meta-commands (\set, \echo) so it runs unchanged
-- in the dashboard editor.
--
-- The whole thing runs in one transaction that ends in ROLLBACK, so it leaves
-- nothing behind and is safe to run against a real hosted project. Any failed
-- assertion aborts with 'ASSERT FAILED: ...'. Reaching the final notice means
-- every assertion passed.
--
-- Assertions are inlined rather than factored into a helper because the test
-- switches to the `authenticated` role partway through, and inlining avoids
-- depending on cross-role access to a pg_temp function.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the privileged role that runs migrations / the SQL editor)
-- ---------------------------------------------------------------------------

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'a@example.test', '', now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'b@example.test', '', now(), now());

-- Ids sit outside seed.sql's range so the two data sets can never collide.
insert into public.anime (anilist_id, title_romaji) values
  (900001, 'Test A'), (900002, 'Test B'), (900003, 'Test C'),
  (900004, 'Test D'), (900005, 'Test E');

do $$
begin
  raise notice 'phase 1: signup trigger';

  if (select count(*) from public.profiles
       where id in ('11111111-1111-1111-1111-111111111111',
                    '22222222-2222-2222-2222-222222222222')) <> 2 then
    raise exception 'ASSERT FAILED: signup trigger should create one profile per auth user';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Act as user A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
begin
  raise notice 'phase 2: a lone liked title scores 10.0';

  perform public.set_anime_rank(900001, 'liked', 1);

  if (select score from public.user_anime where anilist_id = 900001) <> 10.0 then
    raise exception 'ASSERT FAILED: a lone liked title must score exactly 10.0, got %',
      (select score from public.user_anime where anilist_id = 900001);
  end if;
end $$;

do $$
begin
  raise notice 'phase 3: place across all three buckets';

  perform public.set_anime_rank(900002, 'liked',    1);  -- best liked
  perform public.set_anime_rank(900003, 'ok',       1);
  perform public.set_anime_rank(900004, 'disliked', 1);
  perform public.set_anime_rank(900005, 'liked',    3);  -- worst liked
end $$;

-- Expected: liked 900002,900001,900005 -> ok 900003 -> disliked 900004
do $$
declare
  v_positions integer[];
begin
  select array_agg(rank_position order by rank_position)
    into v_positions
    from public.user_anime
   where user_id = '11111111-1111-1111-1111-111111111111';

  if v_positions <> array[1,2,3,4,5] then
    raise exception 'ASSERT FAILED: positions must be a contiguous 1..5, got %', v_positions;
  end if;

  -- Buckets must stack: every liked ranks above every ok, above every disliked.
  if exists (
    select 1
      from public.user_anime a
      join public.user_anime b on a.user_id = b.user_id
     where a.user_id = '11111111-1111-1111-1111-111111111111'
       and public.sentiment_order(a.sentiment) < public.sentiment_order(b.sentiment)
       and a.rank_position > b.rank_position
  ) then
    raise exception 'ASSERT FAILED: sentiment buckets must occupy contiguous stacked blocks';
  end if;

  -- Monotonicity: score never rises as rank_position grows.
  if exists (
    select 1
      from public.user_anime a
      join public.user_anime b on a.user_id = b.user_id
     where a.user_id = '11111111-1111-1111-1111-111111111111'
       and a.rank_position < b.rank_position
       and a.score < b.score
  ) then
    raise exception 'ASSERT FAILED: score must be non-increasing as rank_position increases';
  end if;

  -- Every score inside [0,10] and inside its own sentiment band.
  if exists (
    select 1 from public.user_anime
     where user_id = '11111111-1111-1111-1111-111111111111'
       and sentiment is not null
       and not (
            (sentiment = 'liked'    and score between 6.7 and 10.0)
         or (sentiment = 'ok'       and score between 3.4 and 6.6)
         or (sentiment = 'disliked' and score between 0.0 and 3.3))
  ) then
    raise exception 'ASSERT FAILED: every score must sit inside its sentiment band';
  end if;

  -- Exact derived values: liked n=3 over the 6.7-10.0 band -> 10.0 / 8.4 / 6.7
  if (select score from public.user_anime where anilist_id = 900002) <> 10.0
     or (select score from public.user_anime where anilist_id = 900001) <> 8.4
     or (select score from public.user_anime where anilist_id = 900005) <> 6.7
     or (select score from public.user_anime where anilist_id = 900003) <> 6.6
     or (select score from public.user_anime where anilist_id = 900004) <> 3.3 then
    raise exception 'ASSERT FAILED: derived scores wrong: %',
      (select string_agg(anilist_id || '=' || score, ' ' order by rank_position)
         from public.user_anime
        where user_id = '11111111-1111-1111-1111-111111111111');
  end if;
end $$;

do $$
begin
  raise notice 'phase 4: feed snapshots the derived score, not the placeholder';

  if (select count(*) from public.activity
       where user_id = '11111111-1111-1111-1111-111111111111'
         and type = 'ranked') <> 5 then
    raise exception 'ASSERT FAILED: expected exactly 5 ranked activity rows, got %',
      (select count(*) from public.activity
        where user_id = '11111111-1111-1111-1111-111111111111' and type = 'ranked');
  end if;

  -- Regression guard: set_anime_rank inserts score=0 as a placeholder before
  -- recompute derives the real value. The feed must never capture the 0.
  if (select score from public.activity
       where user_id = '11111111-1111-1111-1111-111111111111'
         and type = 'ranked' and anilist_id = 900001) <> 10.0 then
    raise exception 'ASSERT FAILED: activity must snapshot the derived score (10.0), got %',
      (select score from public.activity
        where user_id = '11111111-1111-1111-1111-111111111111'
          and type = 'ranked' and anilist_id = 900001);
  end if;
end $$;

do $$
begin
  raise notice 'phase 5: re-ranking does not duplicate rows or feed items';

  perform public.set_anime_rank(900001, 'liked', 3);  -- move it to worst liked

  if (select count(*) from public.user_anime
       where user_id = '11111111-1111-1111-1111-111111111111') <> 5 then
    raise exception 'ASSERT FAILED: re-ranking must not create a duplicate user_anime row';
  end if;

  if (select count(*) from public.activity
       where user_id = '11111111-1111-1111-1111-111111111111'
         and type = 'ranked') <> 5 then
    raise exception 'ASSERT FAILED: re-ranking must not append a second ranked activity';
  end if;

  if (select array_agg(rank_position order by rank_position)
        from public.user_anime
       where user_id = '11111111-1111-1111-1111-111111111111') <> array[1,2,3,4,5] then
    raise exception 'ASSERT FAILED: positions must stay contiguous after a re-rank';
  end if;
end $$;

do $$
begin
  raise notice 'phase 6: deleting mid-list closes the gap and rescores';

  perform public.remove_anime(900002);  -- was the top liked title

  if (select array_agg(rank_position order by rank_position)
        from public.user_anime
       where user_id = '11111111-1111-1111-1111-111111111111') <> array[1,2,3,4] then
    raise exception 'ASSERT FAILED: positions must be contiguous 1..4 after a delete, got %',
      (select array_agg(rank_position order by rank_position)
         from public.user_anime
        where user_id = '11111111-1111-1111-1111-111111111111');
  end if;

  -- Two liked titles remain, so they must re-spread to the band edges.
  if (select score from public.user_anime where anilist_id = 900005) <> 10.0
     or (select score from public.user_anime where anilist_id = 900001) <> 6.7 then
    raise exception 'ASSERT FAILED: remaining liked titles must rescore to 10.0 / 6.7';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Act as user B — RLS
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
begin
  raise notice 'phase 7: public profile is readable by a stranger';

  -- Selecting from profiles at all is the recursion canary: if can_view_user
  -- were not SECURITY DEFINER this raises 42P17 infinite recursion.
  perform count(*) from public.profiles;

  if (select count(*) from public.user_anime
       where user_id = '11111111-1111-1111-1111-111111111111') <> 4 then
    raise exception 'ASSERT FAILED: a public list must be readable by any signed-in user';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.profiles set is_private = true
 where id = '11111111-1111-1111-1111-111111111111';

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
begin
  raise notice 'phase 8: private profile hides the list until followed';

  if (select count(*) from public.user_anime
       where user_id = '11111111-1111-1111-1111-111111111111') <> 0 then
    raise exception 'ASSERT FAILED: a private list must be invisible to a non-follower';
  end if;

  insert into public.follows (follower_id, following_id)
  values ('22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111');

  if (select count(*) from public.user_anime
       where user_id = '11111111-1111-1111-1111-111111111111') <> 4 then
    raise exception 'ASSERT FAILED: following a private user must reveal their list';
  end if;
end $$;

do $$
begin
  raise notice 'phase 9: cannot write rows owned by someone else';

  begin
    insert into public.user_anime (user_id, anilist_id, status)
    values ('11111111-1111-1111-1111-111111111111', 900003, 'want');

    raise exception 'ASSERT FAILED: B must not be able to insert a row owned by A';
  exception
    when insufficient_privilege then
      null;  -- expected: RLS WITH CHECK rejected it
  end;
end $$;

do $$
begin
  raise notice 'phase 10: follow and want both reach the feed';

  if (select count(*) from public.activity
       where user_id = '22222222-2222-2222-2222-222222222222'
         and type = 'followed'
         and target_user = '11111111-1111-1111-1111-111111111111') <> 1 then
    raise exception 'ASSERT FAILED: following should emit exactly one followed activity';
  end if;

  perform public.set_anime_status(900005, 'want');

  if (select count(*) from public.activity
       where user_id = '22222222-2222-2222-2222-222222222222'
         and type = 'want' and anilist_id = 900005) <> 1 then
    raise exception 'ASSERT FAILED: adding to want-to-watch should emit one want activity';
  end if;

  raise notice 'ranking_smoke: all assertions passed';
end $$;

reset role;
rollback;

-- Positive confirmation. The Supabase SQL Editor does not surface RAISE NOTICE
-- output, so a returned row is the only unambiguous "it passed" signal: any
-- failed assertion aborts the script long before execution reaches this line.
select 'ranking_smoke: all assertions passed' as result;
