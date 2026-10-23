-------------------------------------------------------------------------------
-- Community moderation that holds up to abuse.
--
-- 1. Copies: the count orders the recipes, so a script must not push one up.
--    With an account, a copy counts once per player and setup; without one,
--    at most 20 a day per setup.
-- 2. Reports: three accounts were enough to hide anyone's setup. A setup many
--    players copied now needs reports from at least a tenth of them (and
--    never fewer than three), so a small group cannot silence a popular one.
-- 3. A queue for whoever moderates: hidden setups and the reports behind
--    them, readable only with the service role (Supabase Studio).
-------------------------------------------------------------------------------

create table public.setup_copies (
  id bigint generated always as identity primary key,
  setup_id uuid not null references public.public_setups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index setup_copies_once on public.setup_copies (setup_id, user_id) where user_id is not null;
create index setup_copies_recent on public.setup_copies (setup_id, created_at) where user_id is null;
-- Written only by count_copy (security definer); nobody reads it directly.
alter table public.setup_copies enable row level security;

/** Counts a copy: once per player with an account, 20 a day without. */
create or replace function public.count_copy(setup_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
-- The parameter keeps its name (the app calls count_copy({ setup_id })), so
-- bare names are the columns and the parameter is count_copy.setup_id.
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is not null then
    insert into public.setup_copies (setup_id, user_id) values (count_copy.setup_id, uid)
      on conflict (setup_id, user_id) where user_id is not null do nothing;
    if not found then
      return;
    end if;
  else
    if (select count(*) from public.setup_copies c
        where c.setup_id = count_copy.setup_id and c.user_id is null and c.created_at > now() - interval '1 day') >= 20 then
      return;
    end if;
    insert into public.setup_copies (setup_id, user_id) values (count_copy.setup_id, null);
  end if;
  update public.public_setups p set copies = p.copies + 1 where p.id = count_copy.setup_id and not p.hidden;
end $$;
grant execute on function public.count_copy(uuid) to anon, authenticated;

/** Hides a setup once enough different players report it: three, or a
 *  tenth of those who copied it, whichever is more. */
create or replace function public.reports_hide() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  copied int;
begin
  select count(*) into n from public.reports r where r.setup_id = new.setup_id;
  select p.copies into copied from public.public_setups p where p.id = new.setup_id;
  if n >= greatest(3, ceil(coalesce(copied, 0) * 0.1)) then
    update public.public_setups set hidden = true where id = new.setup_id;
  end if;
  return new;
end $$;

-- What a moderator reviews: each hidden setup, its reports and their reasons.
create view public.moderation_queue as
  select p.id, p.name, p.author, p.racket_id, p.copies, p.created_at,
         count(r.*)::int as reports,
         array_remove(array_agg(r.reason order by r.created_at), null) as reasons,
         max(r.created_at) as last_report
  from public.public_setups p
  join public.reports r on r.setup_id = p.id
  where p.hidden
  group by p.id;
revoke all on public.moderation_queue from anon, authenticated;
