alter table public.expense_report_lines
  add column if not exists currency char(3) not null default 'USD';

comment on column public.expense_report_lines.currency is 'Transaction currency for the line item.';

update public.expense_report_lines
set currency = expense_reports.currency
from public.expense_reports
where expense_reports.id = expense_report_lines.expense_report_id;