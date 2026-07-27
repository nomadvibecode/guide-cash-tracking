import { supabase } from './supabase-client.js';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  return supabase;
}

export async function loadExpenseReportsPageData(guideId) {
  const client = requireSupabaseClient();

  const [reportsResult, linesResult, currenciesResult] = await Promise.all([
    client
      .from('expense_reports')
      .select(`
        id,
        tour_id,
        transaction_date,
        transaction_memo,
        currency,
        amount,
        status,
        created_at,
        tours (
          tour_name
        )
      `)
      .eq('guide_id', guideId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    client
      .from('expense_report_lines')
      .select('id, expense_report_id, line_date, description, category, currency, amount, created_at')
      .order('line_date', { ascending: true })
      .order('created_at', { ascending: true }),
    client
      .from('expense_report_line_currency')
      .select('code, label')
      .order('code', { ascending: true }),
  ]);

  const firstError = reportsResult.error ?? linesResult.error ?? currenciesResult.error;

  if (firstError) {
    throw firstError;
  }

  const linesByReportId = new Map();

  for (const line of linesResult.data ?? []) {
    const reportLines = linesByReportId.get(line.expense_report_id) ?? [];
    reportLines.push(line);
    linesByReportId.set(line.expense_report_id, reportLines);
  }

  function calculateRunningBalance(lines) {
    return lines.reduce((total, line) => {
      const amount = Number(line.amount ?? 0);
      return line.direction === 'money_in' ? total + amount : total - amount;
    }, 0);
  }

  return {
    reports: (reportsResult.data ?? []).map((report) => ({
      ...report,
      lines: linesByReportId.get(report.id) ?? [],
      runningBalance: Number(calculateRunningBalance(linesByReportId.get(report.id) ?? []).toFixed(2)),
    })),
    currencies: currenciesResult.data ?? [],
  };
}

function resolveTransactionDirection(transactionType) {
  return transactionType === 'expense' ? 'money_out' : 'money_in';
}

async function recalculateExpenseReportBalance(client, reportId) {
  const { data: lines, error: linesError } = await client
    .from('expense_report_lines')
    .select('direction, amount')
    .eq('expense_report_id', reportId);

  if (linesError) {
    throw linesError;
  }

  const nextAmount = (lines ?? []).reduce((total, line) => {
    const amount = Number(line.amount ?? 0);
    return line.direction === 'money_in' ? total + amount : total - amount;
  }, 0);

  const { error: updateError } = await client
    .from('expense_reports')
    .update({ amount: Number(nextAmount.toFixed(2)) })
    .eq('id', reportId);

  if (updateError) {
    throw updateError;
  }

  return Number(nextAmount.toFixed(2));
}

export async function addExpenseReportLine({ reportId, lineDate, memo, currency, amount, transactionType }) {
  const client = requireSupabaseClient();
  const direction = resolveTransactionDirection(transactionType);

  const { data, error } = await client
    .from('expense_report_lines')
    .insert({
      expense_report_id: reportId,
      line_date: lineDate,
      description: memo,
      category: resolveCategoryFromTransactionType(transactionType),
      direction,
      currency,
      amount,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  await recalculateExpenseReportBalance(client, reportId);

  return data;
}

function resolveCategoryFromTransactionType(transactionType) {
  if (transactionType === 'atm_draw') {
    return 'ATM Draw';
  }

  if (transactionType === 'wire_transfer') {
    return 'Wire Transfer';
  }

  return 'Expense';
}

function resolveTransactionTypeFromLine(line) {
  if (line.direction === 'money_out') {
    return 'expense';
  }

  if (line.category === 'ATM Draw') {
    return 'atm_draw';
  }

  if (line.category === 'Wire Transfer') {
    return 'wire_transfer';
  }

  return 'atm_draw';
}

export async function updateExpenseReportLine({ lineId, reportId, lineDate, memo, currency, amount, transactionType }) {
  const client = requireSupabaseClient();

  const { error } = await client
    .from('expense_report_lines')
    .update({
      line_date: lineDate,
      description: memo,
      category: resolveCategoryFromTransactionType(transactionType),
      direction: resolveTransactionDirection(transactionType),
      currency,
      amount,
    })
    .eq('id', lineId);

  if (error) {
    throw error;
  }

  await recalculateExpenseReportBalance(client, reportId);
}

export async function deleteExpenseReportLine({ lineId, reportId }) {
  const client = requireSupabaseClient();

  const { error } = await client
    .from('expense_report_lines')
    .delete()
    .eq('id', lineId);

  if (error) {
    throw error;
  }

  await recalculateExpenseReportBalance(client, reportId);
}

export function getTransactionTypeFromLine(line) {
  return resolveTransactionTypeFromLine(line);
}