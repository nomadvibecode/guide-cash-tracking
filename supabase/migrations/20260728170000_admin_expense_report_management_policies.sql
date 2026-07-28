-- Admins can create, edit and delete any expense report.
drop policy if exists "expense_reports_admin_insert" on public.expense_reports;
create policy "expense_reports_admin_insert"
on public.expense_reports
for insert
to authenticated
with check (public.has_role('admin'));

drop policy if exists "expense_reports_admin_update" on public.expense_reports;
create policy "expense_reports_admin_update"
on public.expense_reports
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "expense_reports_admin_delete" on public.expense_reports;
create policy "expense_reports_admin_delete"
on public.expense_reports
for delete
to authenticated
using (public.has_role('admin'));
