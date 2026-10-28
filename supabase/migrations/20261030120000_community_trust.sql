-------------------------------------------------------------------------------
-- Why to trust a recipe, beyond its author's word.
--
-- 1. measured_after: the author's own racket, measured after the lead went
--    on, when it agrees with the recipe's numbers. The app checks the two
--    agree before it shows the badge, on every read.
-- 2. recipe_plays: players who saved a recipe and then logged sessions with
--    it in their journal. Once per player and recipe, never the author; the
--    view shows only how many.
-------------------------------------------------------------------------------

alter table public.public_setups
  -- { weightG, balanceCm, swingweight, strung, date }, rounded.
  add column measured_after jsonb check (measured_after is null or pg_column_size(measured_after) < 256);
grant update (measured_after) on public.public_setups to authenticated;

create table public.recipe_plays (
  setup_id uuid not null references public.public_setups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (setup_id, user_id)
);
-- Written only by count_play; read only through the view's count.
alter table public.recipe_plays enable row level security;

/** A player played a recipe they saved: counted once, never for its author. */
create function public.count_play(setup_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  insert into public.recipe_plays (setup_id, user_id)
    select p.id, uid from public.public_setups p
    where p.id = count_play.setup_id and not p.hidden and p.user_id <> uid
    on conflict do nothing;
end $$;
revoke all on function public.count_play(uuid) from public, anon;
grant execute on function public.count_play(uuid) to authenticated;

-- The view as before, with the two new columns at its end.
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
    (select count(*)::int from public.recipe_plays r where r.setup_id = p.id) as plays
  from public.public_setups p
  join public.author_keys k on k.user_id = p.user_id
  where not p.hidden or p.user_id = auth.uid();
