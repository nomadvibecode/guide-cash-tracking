drop policy if exists "tours_owner_select" on public.tours;

create policy "tours_owner_select"
on public.tours
for select
to authenticated
using (auth.uid() = tour_guide_id);

drop policy if exists "expense_reports_owner_select" on public.expense_reports;

create policy "expense_reports_owner_select"
on public.expense_reports
for select
to authenticated
using (auth.uid() = guide_id);