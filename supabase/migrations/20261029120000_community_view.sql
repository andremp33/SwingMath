-------------------------------------------------------------------------------
-- The community reads through a view, never the table.
--
-- 1. Every row of public_setups carried its author's account id, so anyone
--    could gather all a player published, signed or "anonymous". The view
--    gives each author an opaque key instead: stable, so hiding an author
--    still works, but tied to nothing else.
-- 2. The author sees their own recipes there too, hidden ones included,
--    with `hidden` and `mine`, so the app can say a recipe was hidden.
-- 3. The table itself is now readable only by its author (to update and
--    delete by id); anyone else reads the view.
-------------------------------------------------------------------------------

create table public.author_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key uuid not null unique default gen_random_uuid()
);
-- Read only through the view; written only by the trigger below.
alter table public.author_keys enable row level security;

insert into public.author_keys (user_id)
  select distinct user_id from public.public_setups
  on conflict do nothing;

create function public.author_key_for_setup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.author_keys (user_id) values (new.user_id) on conflict do nothing;
  return new;
end $$;
create trigger author_key_for_setup before insert on public.public_setups
  for each row execute function public.author_key_for_setup();

-- Runs as its owner, like public_setup_counts: it filters what it shows.
create view public.community_setups as
  select
    p.id,
    k.key as author_key,
    p.racket_id, p.name, p.author, p.config, p.racket, p.specs, p.copies,
    p.created_at, p.goals, p.level, p.style, p.results, p.partner, p.updated_at,
    p.hidden,
    coalesce(p.user_id = auth.uid(), false) as mine,
    -- The author's own setup id is theirs alone.
    case when p.user_id = auth.uid() then p.setup_ref end as setup_ref
  from public.public_setups p
  join public.author_keys k on k.user_id = p.user_id
  where not p.hidden or p.user_id = auth.uid();
grant select on public.community_setups to anon, authenticated;

drop policy "read visible setups" on public.public_setups;
create policy "read own setups" on public.public_setups
  for select to authenticated using (user_id = auth.uid());
revoke select on public.public_setups from anon;
