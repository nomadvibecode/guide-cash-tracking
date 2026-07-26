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

create table public.guide_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.guide_profiles is 'Public guide profile data for demo rendering.';

alter table public.guide_profiles enable row level security;

drop policy if exists "guide_profiles_public_select" on public.guide_profiles;
create policy "guide_profiles_public_select"
on public.guide_profiles
for select
to anon
using (true);

drop policy if exists "guide_profiles_authenticated_select" on public.guide_profiles;
create policy "guide_profiles_authenticated_select"
on public.guide_profiles
for select
to authenticated
using (true);

revoke all on table public.guide_profiles from anon, public;
grant select on table public.guide_profiles to anon, authenticated;

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
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_report_lines is 'Individual expense rows within an expense report.';

create index expense_report_lines_expense_report_id_idx on public.expense_report_lines (expense_report_id);
create index expense_report_lines_line_date_idx on public.expense_report_lines (line_date);

alter table public.tours enable row level security;

drop policy if exists "tours_owner_select" on public.tours;
create policy "tours_owner_select"
on public.tours
for select
to authenticated
using (auth.uid() = tour_guide_id);

drop policy if exists "tours_public_select" on public.tours;
create policy "tours_public_select"
on public.tours
for select
to anon
using (true);

drop policy if exists "tours_owner_insert" on public.tours;
create policy "tours_owner_insert"
on public.tours
for insert
to authenticated
with check (auth.uid() = tour_guide_id);

drop policy if exists "tours_owner_update" on public.tours;
revoke all on table public.tours from anon, public;
grant select on table public.tours to anon;
grant select, insert on table public.tours to authenticated;

alter table public.expense_reports enable row level security;

drop policy if exists "expense_reports_owner_select" on public.expense_reports;
create policy "expense_reports_owner_select"
on public.expense_reports
for select
to authenticated
using (auth.uid() = guide_id);

drop policy if exists "expense_reports_public_select" on public.expense_reports;
create policy "expense_reports_public_select"
on public.expense_reports
for select
to anon
using (true);

drop policy if exists "expense_reports_owner_insert" on public.expense_reports;
create policy "expense_reports_owner_insert"
on public.expense_reports
for insert
to authenticated
with check (auth.uid() = guide_id);

drop policy if exists "expense_reports_owner_update" on public.expense_reports;
create policy "expense_reports_owner_update"
on public.expense_reports
for update
to authenticated
using (auth.uid() = guide_id)
with check (auth.uid() = guide_id);

drop policy if exists "expense_reports_owner_delete" on public.expense_reports;
create policy "expense_reports_owner_delete"
on public.expense_reports
for delete
to authenticated
using (auth.uid() = guide_id);

revoke all on table public.expense_reports from anon, public;
grant select on table public.expense_reports to anon;
grant select, insert, update, delete on table public.expense_reports to authenticated;

alter table public.expense_report_lines enable row level security;

drop policy if exists "expense_report_lines_owner_select" on public.expense_report_lines;
create policy "expense_report_lines_owner_select"
on public.expense_report_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_lines.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

drop policy if exists "expense_report_lines_public_select" on public.expense_report_lines;
create policy "expense_report_lines_public_select"
on public.expense_report_lines
for select
to anon
using (true);

drop policy if exists "expense_report_lines_owner_insert" on public.expense_report_lines;
create policy "expense_report_lines_owner_insert"
on public.expense_report_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_lines.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

drop policy if exists "expense_report_lines_owner_update" on public.expense_report_lines;
create policy "expense_report_lines_owner_update"
on public.expense_report_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_lines.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_lines.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

drop policy if exists "expense_report_lines_owner_delete" on public.expense_report_lines;
create policy "expense_report_lines_owner_delete"
on public.expense_report_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.expense_reports
    where expense_reports.id = expense_report_lines.expense_report_id
      and expense_reports.guide_id = auth.uid()
  )
);

revoke all on table public.expense_report_lines from anon, public;
grant select on table public.expense_report_lines to anon;
grant select, insert, update, delete on table public.expense_report_lines to authenticated;