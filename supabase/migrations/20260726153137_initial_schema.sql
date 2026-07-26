-- Initial simplified schema for Guide Cash Tracking
-- Tour guides are Supabase Auth users (auth.users). No separate guides table yet.

create extension if not exists pgcrypto;

create type public.tour_status as enum ('not_started', 'in_progress', 'finished');
create type public.expense_report_status as enum ('not_submitted', 'submitted', 'processed');

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  tour_name text not null,
  start_date date not null,
  end_date date not null,
  tour_guide_id uuid not null references auth.users(id) on delete restrict,
  status public.tour_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tours_date_order_check check (end_date >= start_date)
);

comment on table public.tours is 'Tours assigned to authenticated tour guides.';
comment on column public.tours.status is 'Tour status: not_started (red), in_progress (yellow), finished (green).';

create index tours_tour_guide_id_idx on public.tours (tour_guide_id);
create index tours_status_idx on public.tours (status);
create index tours_start_date_idx on public.tours (start_date);

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