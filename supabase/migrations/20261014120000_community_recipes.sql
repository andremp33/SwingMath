-------------------------------------------------------------------------------
-- Recipes: what a published setup is for, who plays it, and (if the author
-- chooses) how it played in their journal. Never arm pain or journal notes.
-------------------------------------------------------------------------------
alter table public.public_setups
  add column goals text[] not null default '{}'
    check (cardinality(goals) <= 2
      and goals <@ array['stability', 'power', 'manoeuvrability', 'spin', 'control', 'comfort']::text[]),
  add column level text check (level in ('beginner', 'intermediate', 'advanced', 'competition')),
  add column style text check (style in ('baseline', 'allcourt', 'net')),
  -- { sessions, hours, avg: { overall, power, control, spin, comfort } }, rounded.
  add column results jsonb check (results is null or pg_column_size(results) < 1024),
  -- The author's own setup id, so publishing again updates the same row.
  add column setup_ref text check (char_length(setup_ref) <= 64),
  -- A partner shop's name, set only by us (service role).
  add column partner text check (char_length(partner) <= 40),
  add column updated_at timestamptz not null default now(),
  add constraint public_setups_user_ref unique (user_id, setup_ref);

drop policy "publish own setups" on public.public_setups;
create policy "publish own setups" on public.public_setups
  for insert to authenticated
  with check (user_id = auth.uid() and copies = 0 and not hidden and partner is null);

-- Authors may change their recipe, never its counters, visibility or badge.
-- count_copy and reports_hide are security definer, so they still update.
revoke update on public.public_setups from anon, authenticated;
grant update (name, author, config, racket, specs, goals, level, style, results, updated_at)
  on public.public_setups to authenticated;
create policy "update own setups" on public.public_setups
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- How many visible setups each frame has, for the library. Runs as its
-- owner, like measurement_stats, so it counts only what it filters.
create view public.public_setup_counts as
  select racket_id, count(*)::int as n from public.public_setups where not hidden group by racket_id;
grant select on public.public_setup_counts to anon, authenticated;
