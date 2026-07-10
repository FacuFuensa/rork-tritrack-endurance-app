-- ===========================================================================
-- TriTrack Endurance — Complete Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
-- ===========================================================================
-- Tables created:
--   1. profiles          — user display info, name tags, Strava tokens
--   2. friend_requests   — pending / accepted / declined requests
--   3. friends           — mutual friendships (ordered pair user_a < user_b)
--   4. user_stats        — shared workout stats for friend comparisons
--   5. invite_links      — shareable invite codes for adding friends
--   6. activities        — imported activities (Strava, Garmin, etc.)
--
-- All tables use Row Level Security (RLS).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text        not null default '',
  name_tag            text        not null default '',
  avatar_url          text,
  -- Strava integration fields (used by IronLog web app / integrations screen)
  strava_access_token text,
  strava_athlete_id   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Unique name tag so no two users share the same handle
create unique index if not exists profiles_name_tag_key
  on public.profiles (name_tag)
  where name_tag <> '';

-- Enforce the canonical ordering (user_a < user_b) at the DB level
alter table public.profiles
  enable row level security;

-- Users can read any profile (needed for search & friend lookups)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- Users can insert/update only their own profile
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. FRIEND_REQUESTS
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid        not null references auth.users(id) on delete cascade,
  to_user_id   uuid        not null references auth.users(id) on delete cascade,
  status       text        not null default 'pending'
                             check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists friend_requests_to_user_idx
  on public.friend_requests (to_user_id, status);

create index if not exists friend_requests_from_user_idx
  on public.friend_requests (from_user_id, status);

alter table public.friend_requests
  enable row level security;

-- A user can see requests they sent or received
drop policy if exists "friend_requests_select_involved" on public.friend_requests;
create policy "friend_requests_select_involved"
  on public.friend_requests for select
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- A user can insert a request from themselves
drop policy if exists "friend_requests_insert_own" on public.friend_requests;
create policy "friend_requests_insert_own"
  on public.friend_requests for insert
  with check (from_user_id = auth.uid());

-- A user can update requests they are involved in (accept/decline)
drop policy if exists "friend_requests_update_involved" on public.friend_requests;
create policy "friend_requests_update_involved"
  on public.friend_requests for update
  using (from_user_id = auth.uid() or to_user_id = auth.uid())
  with check (from_user_id = auth.uid() or to_user_id = auth.uid());

-- A user can delete (cancel) requests they sent
drop policy if exists "friend_requests_delete_own" on public.friend_requests;
create policy "friend_requests_delete_own"
  on public.friend_requests for delete
  using (from_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. FRIENDS  (mutual friendships — ordered pair)
-- ---------------------------------------------------------------------------
create table if not exists public.friends (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid        not null references auth.users(id) on delete cascade,
  user_b     uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Enforce user_a < user_b to prevent duplicate rows in opposite order
  constraint friends_ordered_check check (user_a < user_b)
);

create unique index if not exists friends_pair_unique
  on public.friends (user_a, user_b);

create index if not exists friends_user_a_idx on public.friends (user_a);
create index if not exists friends_user_b_idx on public.friends (user_b);

alter table public.friends
  enable row level security;

-- A user can see friendships where they are either user_a or user_b
drop policy if exists "friends_select_involved" on public.friends;
create policy "friends_select_involved"
  on public.friends for select
  using (user_a = auth.uid() or user_b = auth.uid());

-- A user can insert a friendship where they are a participant
drop policy if exists "friends_insert_involved" on public.friends;
create policy "friends_insert_involved"
  on public.friends for insert
  with check (user_a = auth.uid() or user_b = auth.uid());

-- A user can delete (unfriend) a friendship where they are a participant
drop policy if exists "friends_delete_involved" on public.friends;
create policy "friends_delete_involved"
  on public.friends for delete
  using (user_a = auth.uid() or user_b = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. USER_STATS  — shared workout stats
-- ---------------------------------------------------------------------------
create table if not exists public.user_stats (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  total_workouts       integer not null default 0,
  best_run_distance    numeric not null default 0,
  longest_ride         numeric not null default 0,
  swim_total           numeric not null default 0,
  current_streak       integer not null default 0,
  total_training_time  numeric not null default 0,
  updated_at           timestamptz not null default now()
);

alter table public.user_stats
  enable row level security;

-- Anyone can read stats (for friend comparisons) — profiles are visible anyway
drop policy if exists "user_stats_select_all" on public.user_stats;
create policy "user_stats_select_all"
  on public.user_stats for select
  using (true);

-- Only the owner can upsert their own stats
drop policy if exists "user_stats_upsert_own" on public.user_stats;
create policy "user_stats_upsert_own"
  on public.user_stats for insert
  with check (user_id = auth.uid());

drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own"
  on public.user_stats for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. INVITE_LINKS — shareable friend invite codes
-- ---------------------------------------------------------------------------
create table if not exists public.invite_links (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null unique,
  created_by uuid        not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  used_by    uuid        references auth.users(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invite_links_code_idx on public.invite_links (code);

alter table public.invite_links
  enable row level security;

-- Anyone authenticated can look up an invite by code (to accept it)
drop policy if exists "invite_links_select_all" on public.invite_links;
create policy "invite_links_select_all"
  on public.invite_links for select
  using (true);

-- Only the creator can insert an invite link
drop policy if exists "invite_links_insert_own" on public.invite_links;
create policy "invite_links_insert_own"
  on public.invite_links for insert
  with check (created_by = auth.uid());

-- Any authenticated user can mark an invite as used (by updating used_by)
drop policy if exists "invite_links_update_auth" on public.invite_links;
create policy "invite_links_update_auth"
  on public.invite_links for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 6. ACTIVITIES — imported workouts (Strava, Garmin, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  source           text        not null check (source in ('strava', 'garmin', 'whoop', 'healthkit', 'manual')),
  external_id      text,
  type             text        not null default '',
  distance         numeric     not null default 0,
  duration_seconds integer     not null default 0,
  elevation        numeric,
  calories         numeric,
  heart_rate       numeric,
  avg_speed        numeric,
  laps             integer,
  start_time       timestamptz,
  imported_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists activities_user_idx on public.activities (user_id);
create index if not exists activities_source_idx on public.activities (user_id, source);
create unique index if not exists activities_external_unique
  on public.activities (user_id, source, external_id)
  where external_id is not null;

alter table public.activities
  enable row level security;

-- Users can read only their own activities
drop policy if exists "activities_select_own" on public.activities;
create policy "activities_select_own"
  on public.activities for select
  using (user_id = auth.uid());

-- Users can insert only their own activities
drop policy if exists "activities_insert_own" on public.activities;
create policy "activities_insert_own"
  on public.activities for insert
  with check (user_id = auth.uid());

-- Users can update only their own activities
drop policy if exists "activities_update_own" on public.activities;
create policy "activities_update_own"
  on public.activities for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete only their own activities
drop policy if exists "activities_delete_own" on public.activities;
create policy "activities_delete_own"
  on public.activities for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- HELPER: auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- END OF SCHEMA
-- ===========================================================================
