-- Admins can edit and delete any guide profile.
drop policy if exists "guide_profiles_admin_update" on public.guide_profiles;
create policy "guide_profiles_admin_update"
on public.guide_profiles
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "guide_profiles_admin_delete" on public.guide_profiles;
create policy "guide_profiles_admin_delete"
on public.guide_profiles
for delete
to authenticated
using (public.has_role('admin'));

grant delete on table public.guide_profiles to authenticated;
