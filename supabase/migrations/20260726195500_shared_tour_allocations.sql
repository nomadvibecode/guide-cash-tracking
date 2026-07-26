create table public.tour_guides (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  guide_id uuid not null references public.guide_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint tour_guides_unique_tour_guide unique (tour_id, guide_id)
);

comment on table public.tour_guides is 'Guide allocations for tours. The owner is mirrored here so each assigned guide can appear in the shared tour list.';

create index tour_guides_tour_id_idx on public.tour_guides (tour_id);
create index tour_guides_guide_id_idx on public.tour_guides (guide_id);

create or replace function public.enforce_tour_guide_capacity()
returns trigger
language plpgsql
as $$
declare
  allocated_count integer;
begin
  select count(*)
  into allocated_count
  from public.tour_guides
  where tour_id = new.tour_id;

  if allocated_count >= 3 then
    raise exception 'A tour can have at most 3 guides.';
  end if;

  return new;
end;
$$;

drop trigger if exists tour_guides_capacity_trigger on public.tour_guides;
create trigger tour_guides_capacity_trigger
before insert on public.tour_guides
for each row
execute function public.enforce_tour_guide_capacity();

alter table public.tour_guides enable row level security;

drop policy if exists "tour_guides_authenticated_select" on public.tour_guides;
create policy "tour_guides_authenticated_select"
on public.tour_guides
for select
to authenticated
using (true);

drop policy if exists "tour_guides_authenticated_insert" on public.tour_guides;
create policy "tour_guides_authenticated_insert"
on public.tour_guides
for insert
to authenticated
with check (auth.uid() = guide_id);

drop policy if exists "tour_guides_authenticated_delete" on public.tour_guides;
create policy "tour_guides_authenticated_delete"
on public.tour_guides
for delete
to authenticated
using (auth.uid() = guide_id);

revoke all on table public.tour_guides from anon, public;
grant select on table public.tour_guides to authenticated;
grant insert, delete on table public.tour_guides to authenticated;

insert into public.tour_guides (tour_id, guide_id)
select id, tour_guide_id
from public.tours
on conflict (tour_id, guide_id) do nothing;