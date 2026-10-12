-- Pro bought in the Android or iOS app (Google Play, App Store), through
-- RevenueCat. One row per account, written only by the rc-webhook function
-- from what RevenueCat reports; the statuses match public.subscriptions.
create table public.store_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  store text not null,
  product_id text,
  status text not null check (status in ('on_trial', 'active', 'past_due', 'cancelled', 'expired')),
  -- End of the paid (or trial) period; null for a lifetime purchase.
  ends_at timestamptz,
  sandbox boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.store_subscriptions enable row level security;
create policy "read own store subscription" on public.store_subscriptions
  for select to authenticated
  using (user_id = auth.uid());
-- No insert/update/delete policies: only the service role (webhook) writes.

create or replace function public.has_pro(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select enabled from public.app_flags where name = 'pro_beta'), false)
    or exists (
      select 1 from public.subscriptions s
      where (s.user_id = uid or s.email = (select lower(u.email) from auth.users u where u.id = uid))
        and (
          s.status in ('on_trial', 'active', 'past_due')
          or (s.status = 'cancelled' and s.ends_at > now())
        )
    )
    or exists (
      select 1 from public.store_subscriptions s
      where s.user_id = uid
        and s.status <> 'expired'
        and (s.ends_at is null or s.ends_at > now())
    )
$$;
