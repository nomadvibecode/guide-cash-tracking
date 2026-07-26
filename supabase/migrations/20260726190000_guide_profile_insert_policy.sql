drop policy if exists "guide_profiles_authenticated_insert" on public.guide_profiles;

create policy "guide_profiles_authenticated_insert"
on public.guide_profiles
for insert
to authenticated
with check (auth.uid() = id);

grant insert on table public.guide_profiles to authenticated;