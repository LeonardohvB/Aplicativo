
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  display_name text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "profiles select own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles upsert own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles update own" on public.profiles
for update using (auth.uid() = id);
