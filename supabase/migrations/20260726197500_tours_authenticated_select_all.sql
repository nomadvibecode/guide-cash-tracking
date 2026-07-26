drop policy if exists "tours_owner_select" on public.tours;

create policy "tours_authenticated_select"
on public.tours
for select
to authenticated
using (true);