create extension if not exists pgcrypto; -- needed for gen_random_uuid()

-- PROFILES
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles self" on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- WORKOUTS
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  request jsonb not null,
  title text not null,
  notes text,
  sets jsonb not null,
  completed boolean default false,
  feedback jsonb
);
alter table public.workouts enable row level security;
create policy "workouts owner" on public.workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PRs
create table if not exists public.prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  movement text not null,
  rep_max smallint not null check (rep_max in (1,3,5,10)),
  weight_kg numeric not null,
  date date not null default current_date
);
alter table public.prs enable row level security;
create policy "prs owner" on public.prs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ACHIEVEMENTS
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  progress numeric not null default 0,
  unlocked boolean not null default false,
  updated_at timestamptz default now()
);
alter table public.achievements enable row level security;
create policy "achievements owner" on public.achievements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- WEARABLE CONNECTIONS
create table if not exists public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  connected boolean not null default false,
  last_sync timestamptz
);
alter table public.wearable_connections enable row level security;
create policy "wearables owner" on public.wearable_connections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- HEALTH REPORTS
create table if not exists public.health_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  summary text,
  metrics jsonb not null default '{}',
  suggestions text[] not null default '{}'
);
alter table public.health_reports enable row level security;
create policy "reports owner" on public.health_reports for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());