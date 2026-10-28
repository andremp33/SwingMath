-------------------------------------------------------------------------------
-- A short note with a recipe: what changed in how it feels, who it suits.
-- 200 characters, written by its author only; the app checks its words as it
-- does the name's. Reports and moderation cover it like the rest.
-------------------------------------------------------------------------------

alter table public.public_setups
  add column note text check (note is null or char_length(btrim(note)) between 1 and 200);
grant update (note) on public.public_setups to authenticated;

-- Changing the note is an edit: a blocked author cannot.
create or replace function public.public_setups_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- count_copy, reports_hide and moderators touch only these.
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.author is not distinct from old.author
     and new.config is not distinct from old.config and new.specs is not distinct from old.specs
     and new.note is not distinct from old.note then
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

-- The view as before, with the note at its end.
create or replace view public.community_setups as
  select
    p.id,
    k.key as author_key,
    p.racket_id, p.name, p.author, p.config, p.racket, p.specs, p.copies,
    p.created_at, p.goals, p.level, p.style, p.results, p.partner, p.updated_at,
    p.hidden,
    coalesce(p.user_id = auth.uid(), false) as mine,
    case when p.user_id = auth.uid() then p.setup_ref end as setup_ref,
    p.measured_after,
    (select count(*)::int from public.recipe_plays r where r.setup_id = p.id) as plays,
    p.note
  from public.public_setups p
  join public.author_keys k on k.user_id = p.user_id
  where not p.hidden or p.user_id = auth.uid();

-- The queue shows the note too: it may be what was reported.
drop function public.moderation_list();
create function public.moderation_list()
returns table (
  id uuid, name text, author text, racket_id text, config jsonb, specs jsonb, copies int,
  created_at timestamptz, reports int, reasons text[], last_report timestamptz, author_blocked boolean, note text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then
    raise exception 'not a moderator';
  end if;
  return query
    select q.id, q.name, q.author, q.racket_id, p.config, p.specs, q.copies, q.created_at, q.reports, q.reasons, q.last_report,
           exists (select 1 from public.blocked_publishers b where b.user_id = p.user_id), p.note
    from public.moderation_queue q
    join public.public_setups p on p.id = q.id
    order by q.last_report desc;
end $$;
revoke all on function public.moderation_list() from public, anon;
grant execute on function public.moderation_list() to authenticated;
