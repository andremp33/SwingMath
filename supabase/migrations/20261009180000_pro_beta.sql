-- While Pro is in beta, every account can use it (sync included).
-- To start selling: update public.app_flags set enabled = false where name = 'pro_beta';
create table public.app_flags (
  name text primary key,
  enabled boolean not null
);
alter table public.app_flags enable row level security;
create policy "read flags" on public.app_flags for select to anon, authenticated using (true);
insert into public.app_flags (name, enabled) values ('pro_beta', true);

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
$$;
