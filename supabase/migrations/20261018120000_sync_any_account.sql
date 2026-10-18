-- Syncing is the player's backup, so any account may keep its own items in
-- the cloud: writing no longer needs Pro. has_pro stays (the store's Pro is
-- still checked with it elsewhere).
drop policy "write own items with pro" on public.items;
drop policy "update own items with pro" on public.items;

create policy "write own items" on public.items
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own items" on public.items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
