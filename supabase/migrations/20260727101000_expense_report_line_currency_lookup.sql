create table public.expense_report_line_currency (
  code char(3) primary key,
  label text not null
);

comment on table public.expense_report_line_currency is 'Allowed currencies for expense report line items.';

insert into public.expense_report_line_currency (code, label)
values
  ('EUR', 'Euro'),
  ('CHF', 'Swiss franc'),
  ('USD', 'US dollar')
on conflict (code) do update
set label = excluded.label;

alter table public.expense_report_line_currency enable row level security;

drop policy if exists "expense_report_line_currency_public_select" on public.expense_report_line_currency;
create policy "expense_report_line_currency_public_select"
on public.expense_report_line_currency
for select
to anon, authenticated
using (true);

revoke all on table public.expense_report_line_currency from anon, public;
grant select on table public.expense_report_line_currency to anon, authenticated;

alter table public.expense_report_lines
  add constraint expense_report_lines_currency_fkey
  foreign key (currency)
  references public.expense_report_line_currency(code)
  on update cascade
  on delete restrict;

comment on column public.expense_report_lines.currency is 'Transaction currency for the line item. References expense_report_line_currency.code.';