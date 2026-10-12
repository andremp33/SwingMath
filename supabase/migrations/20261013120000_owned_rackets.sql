-- The player's own rackets ("Pure Aero #1") sync like the rest of the journal.
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('racket', 'setup', 'owned', 'stringing', 'session'));
