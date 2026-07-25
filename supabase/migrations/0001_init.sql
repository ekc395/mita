-- ============================================================================
-- Mita — initial schema
--
-- Beli-style ranking: a sentiment bucket bounds the score range, an ordinal
-- position within that bucket is found by client-side binary search, and the
-- 0-10 score is derived from the position. rank_position is the source of
-- truth; score is recomputed from it inside every writing transaction.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.anime_status as enum ('watched', 'watching', 'want');
create type public.sentiment    as enum ('liked', 'ok', 'disliked');
create type public.activity_type as enum ('ranked', 'want', 'followed', 'recommended');


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per auth user, created by the on_auth_user_created trigger.
-- username stays null until the user picks one at /onboarding; NULLs are
-- distinct in Postgres, so the unique constraint tolerates many pending rows.
-- The format check forbids uppercase, which makes the plain unique constraint
-- case-insensitive in practice without pulling in the citext extension.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique constraint profiles_username_format
                 check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text constraint profiles_display_name_len
                 check (char_length(display_name) <= 50),
  avatar_url   text,
  bio          text constraint profiles_bio_len check (char_length(bio) <= 300),
  is_private   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Local cache of AniList media, populated server-side on first search/log so
-- we can join and rank without hammering the AniList API.
create table public.anime (
  anilist_id       integer primary key,
  title_romaji     text,
  title_english    text,
  title_native     text,
  cover_image_url  text,
  banner_image_url text,
  format           text,
  status           text,
  season           text,
  season_year      integer,
  episodes         integer,
  duration         integer,
  genres           text[] not null default '{}',
  average_score    integer,  -- AniList's own 0-100 community score, not ours
  description      text,
  synced_at        timestamptz not null default now()
);

create index anime_genres_idx on public.anime using gin (genres);

-- The log / ranking table.
create table public.user_anime (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  anilist_id    integer not null references public.anime (anilist_id) on delete cascade,
  status        public.anime_status not null,
  sentiment     public.sentiment,
  rank_position integer,
  score         numeric(3,1),
  note          text,
  tags          text[] not null default '{}',
  watched_at    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint user_anime_unique_title unique (user_id, anilist_id),
  constraint user_anime_score_range
    check (score is null or (score >= 0 and score <= 10)),
  constraint user_anime_rank_positive
    check (rank_position is null or rank_position > 0),
  -- A row is either fully unranked or fully ranked, and only a 'watched' row
  -- may carry a ranking. This permits watched-but-not-yet-placed rows.
  constraint user_anime_ranked_consistent check (
    (sentiment is null and rank_position is null and score is null)
    or (status = 'watched'
        and sentiment is not null
        and rank_position is not null
        and score is not null)
  )
);

-- Deferred: recompute_user_ranking() renumbers rows wholesale, which
-- transiently collides. A non-deferrable unique constraint would abort
-- mid-statement. (Consequence: this constraint cannot back an ON CONFLICT.)
alter table public.user_anime
  add constraint user_anime_unique_rank
  unique (user_id, rank_position) deferrable initially deferred;

create index user_anime_anilist_idx     on public.user_anime (anilist_id);
create index user_anime_user_status_idx on public.user_anime (user_id, status);

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

create table public.recommendations (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles (id) on delete cascade,
  to_user    uuid not null references public.profiles (id) on delete cascade,
  anilist_id integer not null references public.anime (anilist_id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  constraint recommendations_unique unique (from_user, to_user, anilist_id),
  constraint recommendations_no_self check (from_user <> to_user)
);

create index recommendations_to_user_idx on public.recommendations (to_user, created_at desc);

-- Feed. Written only by triggers / log_activity(); never by clients directly.
-- score is a snapshot so a feed item shows the score as it stood when posted
-- and renders without joining back to user_anime.
create table public.activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.activity_type not null,
  anilist_id  integer references public.anime (anilist_id) on delete cascade,
  target_user uuid references public.profiles (id) on delete cascade,
  score       numeric(3,1),
  created_at  timestamptz not null default now()
);

create index activity_user_idx    on public.activity (user_id, created_at desc);
create index activity_recent_idx  on public.activity (created_at desc);


-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Bucket stacking order: liked block first, then ok, then disliked.
create function public.sentiment_order(s public.sentiment)
returns integer
language sql
immutable
parallel safe
as $$
  select case s
    when 'liked'    then 0
    when 'ok'       then 1
    when 'disliked' then 2
  end;
$$;

-- The single visibility predicate, reused by every read policy.
--
-- SECURITY DEFINER is load-bearing: this reads profiles and follows and is
-- called *from* the RLS policies on those same tables. Without definer rights
-- bypassing RLS internally, evaluating the policy would re-enter itself and
-- fail with infinite recursion.
create function public.can_view_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user = (select auth.uid())
    or exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.is_private = false
    )
    or exists (
      select 1 from public.follows f
       where f.following_id = p_user
         and f.follower_id = (select auth.uid())
    );
$$;

-- Sole write path into activity. SECURITY DEFINER because activity has no
-- INSERT policy, guarded so a caller can only ever log activity as themselves.
-- A null auth.uid() means a service-role/admin session, which is trusted.
create function public.log_activity(
  p_user_id     uuid,
  p_type        public.activity_type,
  p_anilist_id  integer default null,
  p_target_user uuid default null,
  p_score       numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is not null and p_user_id <> uid then
    raise exception 'log_activity: cannot log activity for another user';
  end if;

  insert into public.activity (user_id, type, anilist_id, target_user, score)
  values (p_user_id, p_type, p_anilist_id, p_target_user, p_score);
end;
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_anime_touch_updated_at
  before update on public.user_anime
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- Ranking engine
-- ---------------------------------------------------------------------------

-- Renumbers the caller's ranked rows to a contiguous 1..n (liked block, then
-- ok, then disliked) and rewrites every score from its position.
--
-- Score within a bucket of n items at 1-based position i:
--   band_high - (i - 1) * (band_high - band_low) / max(n - 1, 1)
-- so i=1 lands on band_high and i=n on band_low. A lone item in a bucket gets
-- band_high, which is why a single liked title scores exactly 10.0.
--
-- SECURITY INVOKER (the default): RLS still applies, so this physically cannot
-- touch another user's rows even if the logic is wrong.
create function public.recompute_user_ranking()
returns void
language plpgsql
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'recompute_user_ranking: no authenticated user';
  end if;

  with ordered as (
    select
      ua.id,
      ua.sentiment,
      row_number() over (
        order by public.sentiment_order(ua.sentiment),
                 ua.rank_position nulls last,
                 ua.created_at,
                 ua.id
      ) as global_pos,
      row_number() over (
        partition by ua.sentiment
        order by ua.rank_position nulls last, ua.created_at, ua.id
      ) as bucket_pos,
      count(*) over (partition by ua.sentiment) as bucket_size
    from public.user_anime ua
    where ua.user_id = uid
      and ua.sentiment is not null
  ),
  scored as (
    select
      o.id,
      o.global_pos,
      round(
        b.band_high
          - (o.bucket_pos - 1) * (b.band_high - b.band_low)
            / greatest(o.bucket_size - 1, 1),
        1
      ) as new_score
    from ordered o
    cross join lateral (
      select
        case o.sentiment
          when 'liked' then 10.0 when 'ok' then 6.6 else 3.3 end as band_high,
        case o.sentiment
          when 'liked' then 6.7  when 'ok' then 3.4 else 0.0 end as band_low
    ) b
  )
  update public.user_anime ua
     set rank_position = s.global_pos,
         score         = s.new_score
    from scored s
   where ua.id = s.id
     -- skip no-op writes so rescoring does not churn updated_at
     and (ua.rank_position is distinct from s.global_pos
          or ua.score is distinct from s.new_score);
end;
$$;

-- The write path the ranking wizard calls once its binary search resolves.
-- p_bucket_index is the 1-based insertion slot *within* the sentiment bucket.
create function public.set_anime_rank(
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

-- Want-to-watch / watching. Moving a title off 'watched' drops its ranking.
create function public.set_anime_status(
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

create function public.remove_anime(p_anilist_id integer)
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

  delete from public.user_anime
   where user_id = uid and anilist_id = p_anilist_id;

  perform public.recompute_user_ranking();
end;
$$;


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 'ranked' activity is emitted explicitly by set_anime_rank(), not by a
-- trigger: recompute_user_ranking() rewrites the score on every row of the
-- user's list, so a row-level trigger would both flood the feed and snapshot
-- the placeholder score before it was derived.

create function public.log_want_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.log_activity(new.user_id, 'want', new.anilist_id, null, null);
  return null;
end;
$$;

create trigger user_anime_want_insert
  after insert on public.user_anime
  for each row when (new.status = 'want')
  execute function public.log_want_activity();

create trigger user_anime_want_update
  after update on public.user_anime
  for each row when (old.status is distinct from 'want' and new.status = 'want')
  execute function public.log_want_activity();

create function public.log_follow_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.log_activity(new.follower_id, 'followed', null, new.following_id, null);
  return null;
end;
$$;

create trigger follows_activity
  after insert on public.follows
  for each row execute function public.log_follow_activity();

create function public.log_recommendation_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.log_activity(new.from_user, 'recommended', new.anilist_id, new.to_user, null);
  return null;
end;
$$;

create trigger recommendations_activity
  after insert on public.recommendations
  for each row execute function public.log_recommendation_activity();


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- auth.uid() is wrapped in a scalar subquery throughout so Postgres evaluates
-- it once per query rather than once per row.
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.anime           enable row level security;
alter table public.user_anime      enable row level security;
alter table public.follows         enable row level security;
alter table public.recommendations enable row level security;
alter table public.activity        enable row level security;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_view_user(id));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- anime: readable by anyone signed in; no write policy, so the catalog cache
-- can only be filled by the server's service-role client.
create policy anime_select on public.anime
  for select to authenticated
  using (true);

-- user_anime
create policy user_anime_select on public.user_anime
  for select to authenticated
  using (public.can_view_user(user_id));

create policy user_anime_insert on public.user_anime
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy user_anime_update on public.user_anime
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_anime_delete on public.user_anime
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- follows: the graph itself is public, you may only act as yourself
create policy follows_select on public.follows
  for select to authenticated
  using (true);

create policy follows_insert on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));

create policy follows_delete on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

-- recommendations: visible only to sender and recipient
create policy recommendations_select on public.recommendations
  for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));

create policy recommendations_insert on public.recommendations
  for insert to authenticated
  with check (from_user = (select auth.uid()));

create policy recommendations_delete on public.recommendations
  for delete to authenticated
  using ((select auth.uid()) in (from_user, to_user));

-- activity: read-only to clients, written solely through log_activity()
create policy activity_select on public.activity
  for select to authenticated
  using (public.can_view_user(user_id));


-- ---------------------------------------------------------------------------
-- Grants
--
-- Written explicitly because the project has "automatically expose new tables"
-- disabled, so tables carry no default privileges for the API roles. RLS is
-- still the row-level gate; these grants are the coarser layer beneath it, and
-- give anime and activity a second, policy-independent guarantee of being
-- read-only to clients. Without these, every query fails with
-- "permission denied for table ..." before RLS is ever consulted.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select                         on public.anime           to authenticated;
grant select                         on public.activity        to authenticated;
grant select, insert, update         on public.profiles        to authenticated;
grant select, insert, update, delete on public.user_anime      to authenticated;
grant select, insert, delete         on public.follows         to authenticated;
grant select, insert, delete         on public.recommendations to authenticated;

grant execute on function public.set_anime_rank(integer, public.sentiment, integer) to authenticated;
grant execute on function public.set_anime_status(integer, public.anime_status)      to authenticated;
grant execute on function public.remove_anime(integer)                              to authenticated;
grant execute on function public.recompute_user_ranking()                            to authenticated;
grant execute on function public.can_view_user(uuid)                                 to authenticated;

-- log_activity is definer-rights; keep it off the public RPC surface.
revoke execute on function
  public.log_activity(uuid, public.activity_type, integer, uuid, numeric)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Realtime (live feed on /)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity;
    alter publication supabase_realtime add table public.user_anime;
  end if;
end;
$$;
