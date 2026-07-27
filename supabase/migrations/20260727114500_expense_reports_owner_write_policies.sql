alter table public.expense_reports enable row level security;

drop policy if exists "expense_reports_owner_insert" on public.expense_reports;
create policy "expense_reports_owner_insert"
on public.expense_reports
for insert
to authenticated
with check ((select auth.uid()) = guide_id);

drop policy if exists "expense_reports_owner_update" on public.expense_reports;
create policy "expense_reports_owner_update"
on public.expense_reports
for update
to authenticated
using ((select auth.uid()) = guide_id)
with check ((select auth.uid()) = guide_id);

drop policy if exists "expense_reports_owner_delete" on public.expense_reports;
create policy "expense_reports_owner_delete"
on public.expense_reports
for delete
to authenticated
using ((select auth.uid()) = guide_id);

revoke all on table public.expense_reports from anon, public;
grant select on table public.expense_reports to anon;
grant select, insert, update, delete on table public.expense_reports to authenticated;
