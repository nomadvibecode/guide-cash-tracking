import { supabase } from './supabase-client.js';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  return supabase;
}

function displayNameFromEmail(email) {
  const localPart = (email ?? 'guide').split('@')[0];

  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function ensureGuideWorkspace(user) {
  const client = requireSupabaseClient();

  const { error: profileError } = await client.from('guide_profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    display_name: displayNameFromEmail(user.email),
  });

  if (profileError) {
    throw profileError;
  }

  const { data: reports, error: reportsError } = await client
    .from('expense_reports')
    .select('id')
    .eq('guide_id', user.id)
    .limit(1);

  if (reportsError) {
    throw reportsError;
  }

  if (reports.length > 0) {
    return { created: false };
  }

  const startDate = daysFromNow(0);
  const endDate = daysFromNow(5);

  const { data: tour, error: tourError } = await client
    .from('tours')
    .insert({
      tour_name: 'Starter tour',
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      tour_guide_id: user.id,
      status: 'in_progress',
      guest_count: 0,
    })
    .select('id')
    .single();

  if (tourError) {
    throw tourError;
  }

  const { error: reportError } = await client.from('expense_reports').insert({
    tour_id: tour.id,
    guide_id: user.id,
    transaction_date: formatDate(startDate),
    transaction_memo: 'Opening balance report',
    currency: 'USD',
    amount: 0,
    status: 'not_submitted',
  });

  if (reportError) {
    throw reportError;
  }

  return { created: true };
}

export async function addExpenseTransaction({
  reportId,
  currentAmount,
  transactionDate,
  description,
  category,
  direction,
  currency,
  amount,
}) {
  const client = requireSupabaseClient();
  const signedAmount = direction === 'money_in' ? amount : -amount;

  const { error: insertError } = await client.from('expense_report_lines').insert({
    expense_report_id: reportId,
    line_date: transactionDate,
    description,
    category,
    direction,
    currency,
    amount,
  });

  if (insertError) {
    throw insertError;
  }

  const nextAmount = Number((Number(currentAmount) + signedAmount).toFixed(2));

  const { error: updateError } = await client
    .from('expense_reports')
    .update({ amount: nextAmount })
    .eq('id', reportId);

  if (updateError) {
    throw updateError;
  }

  return nextAmount;
}