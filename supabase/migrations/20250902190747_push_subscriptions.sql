
-- Create table for Web Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid not null,
  endpoint text not null unique,
  p256dh text,
  auth text,
  created_at timestamp with time zone default now()
);

alter table public.push_subscriptions enable row level security;

-- Policy: users read own tenant subscriptions
create policy "read own tenant push" on public.push_subscriptions
for select using (auth.uid() = user_id);

-- Policy: users upsert own subscription in tenant
create policy "upsert own push" on public.push_subscriptions
for insert with check (auth.uid() = user_id);

create policy "update own push" on public.push_subscriptions
for update using (auth.uid() = user_id);

-- Optional index for faster lookups
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_tenant_idx on public.push_subscriptions(tenant_id);
