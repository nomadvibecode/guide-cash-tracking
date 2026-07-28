-- Allow tours to exist without a single designated owner now that guides are
-- allocated via the tour_guides join table (up to 3 per tour).
alter table public.tours alter column tour_guide_id drop not null;

-- Admins can create, edit and delete any tour.
drop policy if exists "tours_admin_insert" on public.tours;
create policy "tours_admin_insert"
on public.tours
for insert
to authenticated
with check (public.has_role('admin'));

drop policy if exists "tours_admin_update" on public.tours;
create policy "tours_admin_update"
on public.tours
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "tours_admin_delete" on public.tours;
create policy "tours_admin_delete"
on public.tours
for delete
to authenticated
using (public.has_role('admin'));

-- Admins can manage guide allocations for any tour.
drop policy if exists "tour_guides_admin_insert" on public.tour_guides;
create policy "tour_guides_admin_insert"
on public.tour_guides
for insert
to authenticated
with check (public.has_role('admin'));

drop policy if exists "tour_guides_admin_delete" on public.tour_guides;
create policy "tour_guides_admin_delete"
on public.tour_guides
for delete
to authenticated
using (public.has_role('admin'));
