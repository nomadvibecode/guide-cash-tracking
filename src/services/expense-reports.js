import { supabase } from './supabase-client.js';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  return supabase;
}

function formatIsoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function ensureExpenseReportsForAssignedTours(client, guideId) {
  const { data: assignments, error: assignmentsError } = await client
    .from('tour_guides')
    .select(`
      tour_id,
      tours (
        tour_name,
        start_date
      )
    `)
    .eq('guide_id', guideId);

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignedTours = assignments ?? [];

  if (assignedTours.length === 0) {
    return;
  }

  const assignedTourIds = [...new Set(assignedTours.map((assignment) => assignment.tour_id).filter(Boolean))];

  if (assignedTourIds.length === 0) {
    return;
  }

  const { data: existingReports, error: existingReportsError } = await client
    .from('expense_reports')
    .select('tour_id')
    .eq('guide_id', guideId)
    .in('tour_id', assignedTourIds);

  if (existingReportsError) {
    throw existingReportsError;
  }

  const existingTourIds = new Set((existingReports ?? []).map((report) => report.tour_id));
  const missingAssignments = assignedTours.filter((assignment) => !existingTourIds.has(assignment.tour_id));

  if (missingAssignments.length === 0) {
    return;
  }

  const now = formatIsoDate(new Date());
  const reportsToInsert = missingAssignments.map((assignment) => ({
    tour_id: assignment.tour_id,
    guide_id: guideId,
    transaction_date: assignment.tours?.start_date ?? now,
    transaction_memo: `Expense report for ${assignment.tours?.tour_name ?? 'tour'}`,
    currency: 'EUR',
    amount: 0,
    status: 'not_submitted',
  }));

  const { error: insertReportsError } = await client
    .from('expense_reports')
    .insert(reportsToInsert);

  if (insertReportsError) {
    throw insertReportsError;
  }
}

export async function loadExpenseReportsPageData(guideId) {
  const client = requireSupabaseClient();

  await ensureExpenseReportsForAssignedTours(client, guideId);

  const [reportsResult, currenciesResult] = await Promise.all([
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
          tour_name,
          start_date,
          end_date
        )
      `)
      .eq('guide_id', guideId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    client
      .from('expense_report_line_currency')
      .select('code, label')
      .order('code', { ascending: true }),
  ]);

  const reportIds = (reportsResult.data ?? []).map((report) => report.id);
  let linesData = [];
  let linesError = null;
  let attachmentsData = [];
  let attachmentsError = null;

  if (reportIds.length > 0) {
    const linesResult = await client
      .from('expense_report_lines')
      .select('id, expense_report_id, line_date, description, category, direction, currency, amount, created_at')
      .in('expense_report_id', reportIds)
      .order('line_date', { ascending: true })
      .order('created_at', { ascending: true });

    linesData = linesResult.data ?? [];
    linesError = linesResult.error;

    const attachmentsResult = await client
      .from('expense_report_attachments')
      .select('id, expense_report_id, file_name, storage_path, mime_type, file_size_bytes, created_at')
      .in('expense_report_id', reportIds)
      .order('created_at', { ascending: false });

    attachmentsData = attachmentsResult.data ?? [];
    attachmentsError = attachmentsResult.error;
  }

  const firstError = reportsResult.error ?? linesError ?? attachmentsError ?? currenciesResult.error;

  if (firstError) {
    throw firstError;
  }

  const linesByReportId = new Map();
  const attachmentsByReportId = new Map();

  for (const line of linesData) {
    const reportLines = linesByReportId.get(line.expense_report_id) ?? [];
    reportLines.push(line);
    linesByReportId.set(line.expense_report_id, reportLines);
  }

  for (const attachment of attachmentsData) {
    const reportAttachments = attachmentsByReportId.get(attachment.expense_report_id) ?? [];
    reportAttachments.push(attachment);
    attachmentsByReportId.set(attachment.expense_report_id, reportAttachments);
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
      attachments: attachmentsByReportId.get(report.id) ?? [],
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

export async function getAllExpenseReports() {
    const { data, error } = await supabase
      .from('expense_reports')
      .select(`
        *,
        tours (
          tour_name
        )
      `)
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return data;
}

export async function getExpenseReportCurrencies() {
  const { data, error } = await supabase
    .from('expense_report_line_currency')
    .select('code, label')
    .order('code', { ascending: true });

  if (error) throw error;
  return data;
}

export async function adminAddExpenseReport(reportData) {
  const { data, error } = await supabase
    .from('expense_reports')
    .insert(reportData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function adminUpdateExpenseReport(reportId, reportData) {
  const { data, error } = await supabase
    .from('expense_reports')
    .update(reportData)
    .eq('id', reportId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExpenseReport(reportId) {
  const { error } = await supabase
    .from('expense_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw error;
}