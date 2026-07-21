-- Rondocode cloud library + room ownership (Supabase / Postgres).
-- Apply in the Supabase SQL editor when enabling Phase 3 auth.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null default '',
  room_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_updated on public.projects (owner_id, updated_at desc);

create table if not exists public.rooms (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.rooms enable row level security;

create policy "owners read projects"
  on public.projects for select
  using (auth.uid() = owner_id);

create policy "owners write projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "owners update projects"
  on public.projects for update
  using (auth.uid() = owner_id);

create policy "owners delete projects"
  on public.projects for delete
  using (auth.uid() = owner_id);

create policy "owners read rooms"
  on public.rooms for select
  using (auth.uid() = owner_id);

create policy "owners write rooms"
  on public.rooms for insert
  with check (auth.uid() = owner_id);

create policy "owners update rooms"
  on public.rooms for update
  using (auth.uid() = owner_id);
