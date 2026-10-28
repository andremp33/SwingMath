-------------------------------------------------------------------------------
-- Moderation that one person can run.
--
-- 1. Limits on publishing: a few recipes a day per account (a setting), and
--    nothing at all from an account a moderator blocked, as the terms say.
-- 2. Reports are reviewed, not deleted: a reviewed report no longer counts
--    towards hiding, and is kept 12 months after its review (the privacy
--    policy), then purged every night.
-- 3. Moderators: accounts listed in public.moderators (added with the
--    service role). They see the queue and act on it in the app, through
--    two functions; nobody else can.
-------------------------------------------------------------------------------

-- 1. Limits ------------------------------------------------------------------

create table public.community_settings (
  id boolean primary key default true check (id),
  -- Recipes one account may publish in 24 hours.
  publish_per_day int not null default 5 check (publish_per_day > 0)
);
insert into public.community_settings default values;
-- Read and written only with the service role (and by the trigger below).
alter table public.community_settings enable row level security;

create table public.blocked_publishers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
alter table public.blocked_publishers enable row level security;

/** What an account may publish: not blocked, at most 30 recipes, and at
 *  most publish_per_day a day. Counters and visibility change freely. */
create or replace function public.public_setups_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- count_copy, reports_hide and moderators touch only these.
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.author is not distinct from old.author
     and new.config is not distinct from old.config and new.specs is not distinct from old.specs then
    return new;
  end if;
  if exists (select 1 from public.blocked_publishers b where b.user_id = new.user_id) then
    raise exception 'publishing blocked';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.public_setups p where p.user_id = new.user_id) >= 30 then
      raise exception 'public setup limit reached';
    end if;
    if (select count(*) from public.public_setups p where p.user_id = new.user_id and p.created_at > now() - interval '1 day')
       >= (select s.publish_per_day from public.community_settings s) then
      raise exception 'publish rate';
    end if;
  end if;
  return new;
end $$;
drop trigger public_setups_limit on public.public_setups;
create trigger public_setups_limit before insert or update on public.public_setups
  for each row execute function public.public_setups_limit();

-- 2. Reviewed reports ---------------------------------------------------------

alter table public.reports add column reviewed_at timestamptz;

/** Hides a setup once enough different players report it, counting only
 *  reports not yet reviewed: three, or a tenth of those who copied it. */
create or replace function public.reports_hide() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  copied int;
begin
  select count(*) into n from public.reports r where r.setup_id = new.setup_id and r.reviewed_at is null;
  select p.copies into copied from public.public_setups p where p.id = new.setup_id;
  if n >= greatest(3, ceil(coalesce(copied, 0) * 0.1)) then
    update public.public_setups set hidden = true where id = new.setup_id;
  end if;
  return new;
end $$;

-- What is left to review: hidden setups with reports nobody reviewed yet.
create or replace view public.moderation_queue as
  select p.id, p.name, p.author, p.racket_id, p.copies, p.created_at,
         count(r.*)::int as reports,
         array_remove(array_agg(r.reason order by r.created_at), null) as reasons,
         max(r.created_at) as last_report
  from public.public_setups p
  join public.reports r on r.setup_id = p.id and r.reviewed_at is null
  where p.hidden
  group by p.id;
revoke all on public.moderation_queue from anon, authenticated;

/** Reports reviewed more than 12 months ago go (the privacy policy). */
create function public.purge_reviewed_reports() returns void
language sql security definer set search_path = '' as $$
  delete from public.reports where reviewed_at < now() - interval '12 months'
$$;
revoke all on function public.purge_reviewed_reports() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('purge-reviewed-reports', '17 3 * * *', 'select public.purge_reviewed_reports()');

-- 3. Moderators ---------------------------------------------------------------

create table public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.moderators enable row level security;

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators m where m.user_id = auth.uid())
$$;
revoke all on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

/** The queue, with what a moderator needs to judge each setup. */
create function public.moderation_list()
returns table (
  id uuid, name text, author text, racket_id text, config jsonb, specs jsonb, copies int,
  created_at timestamptz, reports int, reasons text[], last_report timestamptz, author_blocked boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then
    raise exception 'not a moderator';
  end if;
  return query
    select q.id, q.name, q.author, q.racket_id, p.config, p.specs, q.copies, q.created_at, q.reports, q.reasons, q.last_report,
           exists (select 1 from public.blocked_publishers b where b.user_id = p.user_id)
    from public.moderation_queue q
    join public.public_setups p on p.id = q.id
    order by q.last_report desc;
end $$;
revoke all on function public.moderation_list() from public, anon;
grant execute on function public.moderation_list() to authenticated;

/**
 * A moderator's decision on a hidden setup; its reports are marked reviewed.
 * 'show': visible again. 'keep': stays hidden. 'block': stays hidden, and
 * its author publishes nothing more.
 */
create function public.moderate(setup_id uuid, action text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_moderator() then
    raise exception 'not a moderator';
  end if;
  if action not in ('show', 'keep', 'block') then
    raise exception 'unknown action %', action;
  end if;
  update public.reports set reviewed_at = now() where reports.setup_id = moderate.setup_id and reviewed_at is null;
  if action = 'show' then
    update public.public_setups set hidden = false where id = moderate.setup_id;
  elsif action = 'block' then
    insert into public.blocked_publishers (user_id, reason)
      select p.user_id, 'moderation' from public.public_setups p where p.id = moderate.setup_id
      on conflict do nothing;
  end if;
end $$;
revoke all on function public.moderate(uuid, text) from public, anon;
grant execute on function public.moderate(uuid, text) to authenticated;
