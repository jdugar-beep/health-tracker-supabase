-- Health Tracker Supabase schema
-- Paste this into Supabase SQL Editor and run it once.

create table if not exists public.health_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_weight_lbs numeric,
  goal_weight_lbs numeric,
  goal_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_lbs numeric not null,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  activity_type text default 'Other',
  duration_minutes numeric,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  glasses numeric not null check (glasses > 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists public.junk_food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.health_profiles enable row level security;
alter table public.weight_entries enable row level security;
alter table public.activity_entries enable row level security;
alter table public.water_entries enable row level security;
alter table public.junk_food_entries enable row level security;

do $$ begin
  create policy "Users manage own health profile" on public.health_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users manage own weight entries" on public.weight_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users manage own activity entries" on public.activity_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users manage own water entries" on public.water_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users manage own junk food entries" on public.junk_food_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists weight_entries_user_time_idx on public.weight_entries(user_id, logged_at desc);
create index if not exists activity_entries_user_time_idx on public.activity_entries(user_id, logged_at desc);
create index if not exists water_entries_user_time_idx on public.water_entries(user_id, logged_at desc);
create index if not exists junk_food_entries_user_time_idx on public.junk_food_entries(user_id, logged_at desc);
