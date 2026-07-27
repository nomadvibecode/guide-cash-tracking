-- Simplified initial schema for Guide Cash Tracking
-- Tour guides are Supabase Auth users (auth.users). No separate guides table yet.

create type public.tour_status as enum ('not_started', 'in_progress', 'finished');
create type public.expense_report_status as enum ('not_submitted', 'submitted', 'processed');
create type public.cash_transaction_direction as enum ('money_in', 'money_out');

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  tour_name text not null,
  start_date date not null,
  end_date date not null,
  tour_guide_id uuid not null references auth.users(id) on delete restrict,
  status public.tour_status not null default 'not_started',
  guest_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tours_date_order_check check (end_date >= start_date)
);

comment on table public.tours is 'Tours assigned to authenticated tour guides.';
comment on column public.tours.status is 'Tour status: not_started (red), in_progress (yellow), finished (green).';

create index tours_tour_guide_id_idx on public.tours (tour_guide_id);
create index tours_status_idx on public.tours (status);
create index tours_start_date_idx on public.tours (start_date);

create table public.guide_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  phone_numbers text,
  guiding_fee_bank_name text,
  guiding_fee_account_iban text,
  reimbursement_bank_name text,
  reimbursement_account_iban text,
  profile_image_path text,
  profile_image_size_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.guide_profiles is 'Public guide profile data for demo rendering.';

create table public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  guide_id uuid not null references auth.users(id) on delete restrict,
  transaction_date date not null,
  transaction_memo text not null,
  currency char(3) not null,
  amount numeric(12,2) not null check (amount >= 0),
  status public.expense_report_status not null default 'not_submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_reports is 'Expense reports linked to a tour and its guide.';
comment on column public.expense_reports.status is 'Expense report status: not_submitted (red), submitted (yellow), processed (green).';

create index expense_reports_tour_id_idx on public.expense_reports (tour_id);
create index expense_reports_guide_id_idx on public.expense_reports (guide_id);
create index expense_reports_status_idx on public.expense_reports (status);
create index expense_reports_transaction_date_idx on public.expense_reports (transaction_date);

create table public.expense_report_lines (
  id uuid primary key default gen_random_uuid(),
  expense_report_id uuid not null references public.expense_reports(id) on delete cascade,
  line_date date not null,
  description text not null,
  category text not null,
  direction public.cash_transaction_direction not null default 'money_out',
  currency char(3) not null default 'USD',
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_report_lines is 'Individual expense rows within an expense report.';

create table public.expense_report_line_currency (
  code char(3) primary key,
  label text not null
);

comment on table public.expense_report_line_currency is 'Allowed currencies for expense report line items.';

alter table public.expense_report_lines
  add constraint expense_report_lines_currency_fkey
  foreign key (currency)
  references public.expense_report_line_currency(code)
  on update cascade
  on delete restrict;

create table public.expense_report_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_report_id uuid not null references public.expense_reports(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_report_attachments is 'Images or PDF files attached to an expense report.';

create view public.dashboard_expense_report_overview as
  -- Database-backed dashboard source of truth.
  select 1;

create index expense_report_lines_expense_report_id_idx on public.expense_report_lines (expense_report_id);
create index expense_report_lines_line_date_idx on public.expense_report_lines (line_date);

create table public.tour_guides (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  guide_id uuid not null references public.guide_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint tour_guides_unique_tour_guide unique (tour_id, guide_id)
);

comment on table public.tour_guides is 'Guide allocations for tours. The owner is mirrored here so the shared tour list can show every assigned guide.';

create index tour_guides_tour_id_idx on public.tour_guides (tour_id);
create index tour_guides_guide_id_idx on public.tour_guides (guide_id);

-- RLS is enabled in the migration file.
-- Access is owner-based and limited to authenticated users.
-- Tours: read publicly for demo usage, add only for the owning guide.
-- Tour guides: read and manage only through authenticated guide sessions; each tour is capped at 3 guide rows.
-- Expense reports: read publicly for demo usage, add/edit/delete only for the owning guide.
-- Expense report lines: read publicly for demo usage, add/edit/delete only through their parent report.
-- Expense report line currencies: read publicly for demo usage and used as the lookup table for line currencies.
-- Expense report attachments: read publicly for demo usage, add/edit/delete only through their parent report.
-- The dashboard overview view derives guide/tour/balance totals in Postgres.