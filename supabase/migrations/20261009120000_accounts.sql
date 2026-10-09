-- SwingMath: optional accounts.
-- 1. subscriptions: Pro status, written only by the Lemon Squeezy webhook.
-- 2. items: the player's own data, synced between devices (Pro).
-- 3. measurements: frames measured by players; only aggregates are public.
-- 4. public_setups (+ reports): setups players publish for a frame.

-------------------------------------------------------------------------------
-- 1. Subscriptions
-------------------------------------------------------------------------------
create table public.subscriptions (
  email text primary key check (email = lower(email)),
  -- Set when the checkout was opened from a signed-in app (custom data).
  user_id uuid references auth.users (id) on delete set null,
  status text not null check (status in ('on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired')),
  renews_at timestamptz,
  ends_at timestamptz,
  ls_subscription_id text,
  updated_at timestamptz not null default now()
);
create index on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
-- Players can read their own row (by account or by the email they paid with).
create policy "read own subscription" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or email = lower(auth.jwt() ->> 'email'));
-- No insert/update/delete policies: only the service role (webhook) writes.

/** True while the account has a running subscription, including the paid
 *  rest of a cancelled one. */
create function public.has_pro(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where (s.user_id = uid or s.email = (select lower(u.email) from auth.users u where u.id = uid))
      and (
        s.status in ('on_trial', 'active', 'past_due')
        or (s.status = 'cancelled' and s.ends_at > now())
      )
  )
$$;
revoke all on function public.has_pro(uuid) from public, anon;
grant execute on function public.has_pro(uuid) to authenticated;

-------------------------------------------------------------------------------
-- 2. Synced items. One row per racket, setup, stringing or session; the app
--    keeps the newest version of each (last write wins, by the item's own
--    updatedAt). Deleted items stay as tombstones so other devices delete too.
-------------------------------------------------------------------------------
create table public.items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('racket', 'setup', 'stringing', 'session')),
  id text not null check (char_length(id) between 1 and 64),
  data jsonb check (pg_column_size(data) < 16384),
  deleted boolean not null default false,
  -- The item's updatedAt in the app (ms since 1970).
  client_updated_at bigint not null,
  -- Server time of the last write, for "what changed since".
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id),
  check (deleted or data is not null)
);
create index on public.items (user_id, updated_at);

create function public.items_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- An older copy never overwrites a newer one.
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return null;
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.items where user_id = new.user_id) >= 20000 then
    raise exception 'item limit reached';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger items_before_write before insert or update on public.items
  for each row execute function public.items_before_write();

alter table public.items enable row level security;
create policy "read own items" on public.items
  for select to authenticated using (user_id = auth.uid());
-- Writing (syncing) is a Pro feature, checked here, not only in the app.
create policy "write own items with pro" on public.items
  for insert to authenticated with check (user_id = auth.uid() and public.has_pro(auth.uid()));
create policy "update own items with pro" on public.items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_pro(auth.uid()));
create policy "delete own items" on public.items
  for delete to authenticated using (user_id = auth.uid());

-------------------------------------------------------------------------------
-- 3. Community measurements of library frames. Free with an account. Rows are
--    private; the public sees medians per frame, and only from 3 frames up.
-------------------------------------------------------------------------------
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  racket_id text not null check (racket_id like 'stock-%' and char_length(racket_id) <= 80),
  -- A player may own several of the same frame.
  unit smallint not null default 1 check (unit between 1 and 4),
  strung boolean not null,
  weight_g numeric(5, 1) not null check (weight_g between 200 and 400),
  balance_cm numeric(4, 2) check (balance_cm between 28 and 38),
  swingweight numeric(4, 1) check (swingweight between 240 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, racket_id, strung, unit)
);

alter table public.measurements enable row level security;
create policy "manage own measurements" on public.measurements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create view public.measurement_stats as
  select
    racket_id,
    strung,
    count(*)::int as n,
    percentile_cont(0.5) within group (order by weight_g) as weight_g,
    percentile_cont(0.25) within group (order by weight_g) as weight_p25,
    percentile_cont(0.75) within group (order by weight_g) as weight_p75,
    percentile_cont(0.5) within group (order by balance_cm) as balance_cm,
    count(balance_cm)::int as balance_n,
    percentile_cont(0.5) within group (order by swingweight) as swingweight,
    count(swingweight)::int as swingweight_n
  from public.measurements
  group by racket_id, strung
  having count(*) >= 3;
-- The view runs as its owner, so it can aggregate rows the reader cannot see.
grant select on public.measurement_stats to anon, authenticated;

-------------------------------------------------------------------------------
-- 4. Public setups. Anyone can read; publishing needs an account. Three
--    reports from different players hide a setup until it is reviewed.
-------------------------------------------------------------------------------
create table public.public_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  racket_id text not null check (char_length(racket_id) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  author text check (char_length(author) <= 30),
  -- The setup (lead, accessories, grip, strings) and, for custom frames, the frame.
  config jsonb not null check (pg_column_size(config) < 8192),
  racket jsonb check (pg_column_size(racket) < 4096),
  -- Weight, balance and swingweight at publishing, for the list.
  specs jsonb not null check (pg_column_size(specs) < 1024),
  copies int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.public_setups (racket_id, created_at desc) where not hidden;
create index on public.public_setups (user_id);

create function public.public_setups_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.public_setups where user_id = new.user_id) >= 30 then
    raise exception 'public setup limit reached';
  end if;
  return new;
end $$;
create trigger public_setups_limit before insert on public.public_setups
  for each row execute function public.public_setups_limit();

alter table public.public_setups enable row level security;
create policy "read visible setups" on public.public_setups
  for select to anon, authenticated using (not hidden or user_id = auth.uid());
create policy "publish own setups" on public.public_setups
  for insert to authenticated with check (user_id = auth.uid() and copies = 0 and not hidden);
create policy "delete own setups" on public.public_setups
  for delete to authenticated using (user_id = auth.uid());

/** Counts a copy. Anyone can call it; it only adds one. */
create function public.count_copy(setup_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.public_setups set copies = copies + 1 where id = setup_id and not hidden
$$;
grant execute on function public.count_copy(uuid) to anon, authenticated;

create table public.reports (
  setup_id uuid not null references public.public_setups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (setup_id, user_id)
);
alter table public.reports enable row level security;
create policy "report as yourself" on public.reports
  for insert to authenticated with check (user_id = auth.uid());

create function public.reports_hide() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports where setup_id = new.setup_id) >= 3 then
    update public.public_setups set hidden = true where id = new.setup_id;
  end if;
  return new;
end $$;
create trigger reports_hide after insert on public.reports
  for each row execute function public.reports_hide();

-------------------------------------------------------------------------------
-- Account deletion: removes the account and, by cascade, everything above
-- except the subscription record (kept for the merchant's accounting, unlinked).
-------------------------------------------------------------------------------
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid()
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
