-------------------------------------------------------------------------------
-- Views that show what readers may not read row by row run as their owner.
--
-- measurement_stats gives medians of measurements nobody else can see;
-- public_setup_counts and community_setups show recipes from a table only
-- their authors read. Run as the reader (security_invoker), they come back
-- empty or refused. In production two of them had been switched to it
-- outside the migrations (as the database advisor suggests for views in
-- general): the medians were always empty, and the counts per racket were
-- refused once the table was closed to readers. Said here, they stay put.
-------------------------------------------------------------------------------

alter view public.measurement_stats set (security_invoker = false);
alter view public.public_setup_counts set (security_invoker = false);
alter view public.community_setups set (security_invoker = false);
