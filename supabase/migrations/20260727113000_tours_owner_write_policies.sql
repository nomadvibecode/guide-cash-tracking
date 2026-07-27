alter table public.tours enable row level security;

drop policy if exists "tours_owner_insert" on public.tours;
create policy "tours_owner_insert"
on public.tours
for insert
to authenticated
with check ((select auth.uid()) = tour_guide_id);

drop policy if exists "tours_owner_update" on public.tours;
create policy "tours_owner_update"
on public.tours
for update
to authenticated
using ((select auth.uid()) = tour_guide_id)
with check ((select auth.uid()) = tour_guide_id);

drop policy if exists "tours_owner_delete" on public.tours;
create policy "tours_owner_delete"
on public.tours
for delete
to authenticated
using ((select auth.uid()) = tour_guide_id);

revoke all on table public.tours from anon, public;
grant select on table public.tours to anon;
grant select, insert, update, delete on table public.tours to authenticated;
