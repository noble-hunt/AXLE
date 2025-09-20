-- groups & membership
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  is_public boolean not null default false,
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(user_id) on delete cascade,
  role text not null default 'member',     -- owner|admin|member
  joined_at timestamptz default now(),
  primary key(group_id, user_id)
);

-- posts (canonical post once), then map it to one or many groups
create type public.post_kind as enum ('text','workout','pr','event');
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind public.post_kind not null,
  content jsonb not null,          -- shapes below
  created_at timestamptz default now()
);
-- Cross-post map: one post → many groups
create table if not exists public.group_posts (
  group_id uuid not null references public.groups(id) on delete cascade,
  post_id  uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key(group_id, post_id)
);

-- reactions on a group-post (separate per group)
create table if not exists public.group_reactions (
  group_id uuid not null references public.groups(id) on delete cascade,
  post_id  uuid not null references public.posts(id) on delete cascade,
  user_id  uuid not null references public.profiles(user_id) on delete cascade,
  emoji text not null,   -- 👍❤️🔥😂😮 etc
  created_at timestamptz default now(),
  primary key(group_id, post_id, user_id, emoji)
);

-- invites & referrals
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  invited_email text,                -- optional
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz default now()
);
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(user_id) on delete cascade,
  referred_user_id uuid references public.profiles(user_id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz default now()
);

-- group achievements (simple counter-based)
create table if not exists public.group_achievements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  description text not null,
  progress numeric not null default 0, -- 0..1
  unlocked boolean not null default false,
  updated_at timestamptz default now()
);

-- fast feed queries (ascending for chat-like feed)
create index if not exists idx_group_posts_group_created on public.group_posts (group_id, created_at asc);
create index if not exists idx_posts_user_created on public.posts (user_id, created_at desc);
create index if not exists idx_group_members_user on public.group_members (user_id);
create index if not exists idx_group_reactions_group_post on public.group_reactions (group_id, post_id);

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.group_posts enable row level security;
alter table public.group_reactions enable row level security;
alter table public.group_invites enable row level security;
alter table public.referrals enable row level security;
alter table public.group_achievements enable row level security;

-- Policies
-- NOTE: These policies use current_setting('app.user_id') instead of auth.uid()
-- Your application will need to set this session variable before database operations
-- Example: SET LOCAL app.user_id = '<user_id>';

-- groups: read public; private readable only by members; owner can update/delete
create policy "groups read public or member" on public.groups
for select using (is_public or exists(
  select 1 from public.group_members m 
  where m.group_id = id 
  and m.user_id = current_setting('app.user_id', true)::uuid
));

create policy "groups owner write" on public.groups
for all using (owner_id = current_setting('app.user_id', true)::uuid) 
with check (owner_id = current_setting('app.user_id', true)::uuid);

-- group_members: members read; join via invite handler (server/service)
create policy "members self read" on public.group_members
for select using (
  user_id = current_setting('app.user_id', true)::uuid 
  or exists(select 1 from public.group_members m where m.group_id = group_id and m.user_id = current_setting('app.user_id', true)::uuid)
);

create policy "members self insert" on public.group_members
for insert with check (user_id = current_setting('app.user_id', true)::uuid);

create policy "members self delete" on public.group_members
for delete using (
  user_id = current_setting('app.user_id', true)::uuid 
  or exists(select 1 from public.groups g where g.id = group_id and g.owner_id = current_setting('app.user_id', true)::uuid)
);

-- posts: author read/write; group members can select via join to group_posts
create policy "posts author rw" on public.posts
for all using (user_id = current_setting('app.user_id', true)::uuid) 
with check (user_id = current_setting('app.user_id', true)::uuid);

-- group_posts: only members can link/unlink; readable by members (or public group)
create policy "group_posts member rw" on public.group_posts
for all using (
  exists(select 1 from public.group_members m where m.group_id = group_id and m.user_id = current_setting('app.user_id', true)::uuid)
  or exists(select 1 from public.groups g where g.id = group_id and g.is_public)
) with check (exists(select 1 from public.group_members m where m.group_id = group_id and m.user_id = current_setting('app.user_id', true)::uuid));

-- reactions: only members can react
create policy "reactions member rw" on public.group_reactions
for all using (exists(select 1 from public.group_members m where m.group_id = group_id and m.user_id = current_setting('app.user_id', true)::uuid))
with check (exists(select 1 from public.group_members m where m.group_id = group_id and m.user_id = current_setting('app.user_id', true)::uuid));

-- invites/referrals: creator rw; readable by group admins/members
create policy "invites group admin" on public.group_invites
for all using (exists(select 1 from public.groups g where g.id = group_id and (g.owner_id = current_setting('app.user_id', true)::uuid
    or exists(select 1 from public.group_members m where m.group_id = g.id and m.user_id = current_setting('app.user_id', true)::uuid and m.role in ('owner','admin')))))
with check (exists(select 1 from public.groups g where g.id = group_id and (g.owner_id = current_setting('app.user_id', true)::uuid
    or exists(select 1 from public.group_members m where m.group_id = g.id and m.user_id = current_setting('app.user_id', true)::uuid and m.role in ('owner','admin')))));

create policy "referrals self read" on public.referrals
for select using (referrer_user_id = current_setting('app.user_id', true)::uuid or referred_user_id = current_setting('app.user_id', true)::uuid);