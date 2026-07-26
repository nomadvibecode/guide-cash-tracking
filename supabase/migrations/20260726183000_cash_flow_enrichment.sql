-- Cash flow enrichment for Guide Cash Tracking

create type public.cash_transaction_direction as enum ('money_in', 'money_out');

alter table public.tours
  add column if not exists guest_count integer not null default 0;

comment on column public.tours.guest_count is 'Number of guests assigned to the tour.';

alter table public.guide_profiles
  add column if not exists phone_numbers text,
  add column if not exists guiding_fee_bank_name text,
  add column if not exists guiding_fee_account_iban text,
  add column if not exists reimbursement_bank_name text,
  add column if not exists reimbursement_account_iban text,
  add column if not exists profile_image_path text,
  add column if not exists profile_image_size_bytes integer;

comment on column public.guide_profiles.phone_numbers is 'Guide phone number or numbers.';
comment on column public.guide_profiles.guiding_fee_account_iban is 'Bank account used to pay guiding fees.';
comment on column public.guide_profiles.reimbursement_account_iban is 'Bank account used to pay reimbursements.';
comment on column public.guide_profiles.profile_image_path is 'Storage path for the guide profile picture.';
comment on column public.guide_profiles.profile_image_size_bytes is 'Uploaded profile image size in bytes, limited to 2 MB.';

drop policy if exists "guide_profiles_authenticated_update" on public.guide_profiles;
create policy "guide_profiles_authenticated_update"
on public.guide_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

grant update on table public.guide_profiles to authenticated;

alter table public.expense_report_lines
  add column if not exists direction public.cash_transaction_direction not null default 'money_out';

alter table public.expense_report_lines
  add column if not exists currency char(3) not null default 'USD';

comment on column public.expense_report_lines.direction is 'Money direction for the transaction line: money_in or money_out.';
comment on column public.expense_report_lines.currency is 'Transaction currency for the line item.';

update public.expense_report_lines
set currency = expense_reports.currency
from public.expense_reports
where expense_reports.id = expense_report_lines.expense_report_id;

create index if not exists expense_report_lines_direction_idx on public.expense_report_lines (direction);

create table if not exists public.expense_report_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_report_id uuid not null references public.expense_reports(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_report_attachments is 'Images or PDF files attached to an expense report.';

create index if not exists expense_report_attachments_expense_report_id_idx
  on public.expense_report_attachments (expense_report_id);

alter table public.expense_report_attachments enable row level security;

drop policy if exists "expense_report_attachments_owner_select" on public.expense_report_attachments;
create policy "expense_report_attachments_owner_select"
on public.expense_report_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_attachments.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

drop policy if exists "expense_report_attachments_public_select" on public.expense_report_attachments;
create policy "expense_report_attachments_public_select"
on public.expense_report_attachments
for select
to anon
using (true);

drop policy if exists "expense_report_attachments_owner_insert" on public.expense_report_attachments;
create policy "expense_report_attachments_owner_insert"
on public.expense_report_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_attachments.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

drop policy if exists "expense_report_attachments_owner_update" on public.expense_report_attachments;
create policy "expense_report_attachments_owner_update"
on public.expense_report_attachments
for update
to authenticated
using (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_attachments.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_attachments.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

drop policy if exists "expense_report_attachments_owner_delete" on public.expense_report_attachments;
create policy "expense_report_attachments_owner_delete"
on public.expense_report_attachments
for delete
to authenticated
using (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_attachments.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

revoke all on table public.expense_report_attachments from anon, public;
grant select on table public.expense_report_attachments to anon, authenticated;
grant insert, update, delete on table public.expense_report_attachments to authenticated;

drop view if exists public.dashboard_expense_report_overview;

create view public.dashboard_expense_report_overview
with (security_invoker = true)
as
with line_totals as (
  select
    expense_report_id,
    count(*)::integer as line_count,
    coalesce(sum(amount) filter (where direction = 'money_in'), 0)::numeric(12,2) as money_in_total,
    coalesce(sum(amount) filter (where direction = 'money_out'), 0)::numeric(12,2) as money_out_total
  from public.expense_report_lines
  group by expense_report_id
),
attachment_totals as (
  select
    expense_report_id,
    count(*)::integer as attachment_count
  from public.expense_report_attachments
  group by expense_report_id
),
report_base as (
  select
    expense_reports.id,
    expense_reports.tour_id,
    expense_reports.guide_id,
    expense_reports.transaction_date,
    expense_reports.transaction_memo,
    expense_reports.currency,
    expense_reports.amount,
    expense_reports.status,
    expense_reports.created_at,
    expense_reports.updated_at,
    tours.tour_name,
    tours.start_date,
    tours.end_date,
    tours.guest_count,
    guide_profiles.display_name,
    guide_profiles.email,
    guide_profiles.phone_numbers,
    guide_profiles.guiding_fee_bank_name,
    guide_profiles.guiding_fee_account_iban,
    guide_profiles.reimbursement_bank_name,
    guide_profiles.reimbursement_account_iban,
    guide_profiles.profile_image_path,
    coalesce(line_totals.money_in_total, 0)::numeric(12,2) as money_in_total,
    coalesce(line_totals.money_out_total, 0)::numeric(12,2) as money_out_total,
    coalesce(line_totals.line_count, 0) as line_count,
    coalesce(attachment_totals.attachment_count, 0) as attachment_count,
    (tours.end_date - tours.start_date + 1) as tour_days,
    (coalesce(line_totals.money_in_total, 0) - coalesce(line_totals.money_out_total, 0))::numeric(12,2) as net_change
  from public.expense_reports
  join public.tours on tours.id = expense_reports.tour_id
  join public.guide_profiles on guide_profiles.id = expense_reports.guide_id
  left join line_totals on line_totals.expense_report_id = expense_reports.id
  left join attachment_totals on attachment_totals.expense_report_id = expense_reports.id
)
select
  report_base.*,
  sum(report_base.net_change) over (
    partition by report_base.guide_id
    order by report_base.start_date, report_base.transaction_date, report_base.created_at, report_base.id
    rows between unbounded preceding and current row
  )::numeric(12,2) as running_balance
from report_base;

revoke all on table public.dashboard_expense_report_overview from anon, public;
grant select on table public.dashboard_expense_report_overview to anon, authenticated;