-- Without Pro, an account syncs on one device at a time: the backup stays
-- free, keeping several devices the same is Pro. The device says who it is
-- in a header (x-swing-device) on every request. Signing in on a new device
-- moves the sync there; the old one is told, and can take it back.

create table public.sync_devices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 64),
  claimed_at timestamptz not null default now()
);
alter table public.sync_devices enable row level security;
-- No policies: only the functions below read or write it.

/** The device making this request, from its header. */
create function public.request_device() returns text
language sql stable set search_path = '' as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-swing-device', '')
$$;

/** Pro syncs anywhere; otherwise only the device that claimed the sync (or
 *  any, until one has: apps from before this keep working). */
create function public.may_sync(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_pro(uid)
    or not exists (select 1 from public.sync_devices d where d.user_id = uid)
    or exists (select 1 from public.sync_devices d where d.user_id = uid and d.device_id = public.request_device())
$$;
revoke all on function public.may_sync(uuid) from public, anon;
grant execute on function public.may_sync(uuid) to authenticated;

/** Sync on this device from now on. */
create function public.claim_sync_device() returns void
language plpgsql security definer set search_path = '' as $$
declare
  device text := public.request_device();
begin
  if auth.uid() is null or device is null or char_length(device) not between 8 and 64 then
    raise exception 'no device' using errcode = '22023';
  end if;
  insert into public.sync_devices (user_id, device_id) values (auth.uid(), device)
  on conflict (user_id) do update set device_id = excluded.device_id, claimed_at = now();
end $$;
revoke all on function public.claim_sync_device() from public, anon;
grant execute on function public.claim_sync_device() to authenticated;

/** Whether this device may sync now. */
create function public.sync_here() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.may_sync(auth.uid())
$$;
revoke all on function public.sync_here() from public, anon;
grant execute on function public.sync_here() to authenticated;

-- Reading, writing and deleting items all need the sync (the select wraps
-- the check so it runs once per query, not per row).
drop policy "read own items" on public.items;
drop policy "write own items" on public.items;
drop policy "update own items" on public.items;
drop policy "delete own items" on public.items;

create policy "read own items" on public.items
  for select to authenticated using (user_id = auth.uid() and (select public.may_sync(auth.uid())));
create policy "write own items" on public.items
  for insert to authenticated with check (user_id = auth.uid() and (select public.may_sync(auth.uid())));
create policy "update own items" on public.items
  for update to authenticated
  using (user_id = auth.uid() and (select public.may_sync(auth.uid())))
  with check (user_id = auth.uid() and (select public.may_sync(auth.uid())));
create policy "delete own items" on public.items
  for delete to authenticated using (user_id = auth.uid() and (select public.may_sync(auth.uid())));
