insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-report-receipts',
  'expense-report-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "expense_receipts_authenticated_select" on storage.objects;
create policy "expense_receipts_authenticated_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-report-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "expense_receipts_authenticated_insert" on storage.objects;
create policy "expense_receipts_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-report-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "expense_receipts_authenticated_update" on storage.objects;
create policy "expense_receipts_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'expense-report-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'expense-report-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "expense_receipts_authenticated_delete" on storage.objects;
create policy "expense_receipts_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-report-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

alter table public.expense_report_attachments
  drop constraint if exists expense_report_attachments_mime_type_check;

alter table public.expense_report_attachments
  add constraint expense_report_attachments_mime_type_check
  check (
    mime_type = 'application/pdf'
    or mime_type like 'image/%'
  );