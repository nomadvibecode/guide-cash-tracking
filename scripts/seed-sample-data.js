import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const reportStatuses = ['not_submitted', 'submitted', 'processed'];
const tourStatuses = ['not_started', 'in_progress', 'finished'];
const currencies = ['EUR', 'USD', 'BGN'];
const categories = ['Transport', 'Meals', 'Accommodation', 'Supplies', 'Parking', 'Fuel', 'Tickets'];
const merchants = ['City Market', 'Transit Hub', 'Guest House', 'Road Stop', 'Cafe Central', 'Local Shuttle', 'Museum Desk'];

const today = new Date();

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days) {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
}

function pickRandomItem(items) {
  return items[randomInt(0, items.length)];
}

function createReportMemo(userEmail, tourName) {
  return `Sample expense report for ${userEmail ?? 'guide'} on ${tourName}`;
}

function buildLine(reportDate, lineIndex) {
  const amount = Number((randomInt(1200, 8500) / 100).toFixed(2));
  const lineDate = new Date(reportDate);
  lineDate.setDate(lineDate.getDate() - randomInt(0, 4));

  return {
    line_date: formatDate(lineDate),
    description: `${pickRandomItem(merchants)} - ${pickRandomItem(categories)} ${lineIndex + 1}`,
    category: pickRandomItem(categories),
    amount,
  };
}

async function fetchAllUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 100) {
      break;
    }

    page += 1;
  }

  return users;
}

async function getOrCreateTour(user, userIndex) {
  const { data: existingTours, error: toursError } = await supabase
    .from('tours')
    .select('id, tour_name, start_date, end_date, status')
    .eq('tour_guide_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (toursError) {
    throw toursError;
  }

  if (existingTours.length > 0) {
    return existingTours[0];
  }

  const startDate = daysAgo(21 + userIndex * 2);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + randomInt(2, 6));

  const tourPayload = {
    tour_name: `Sample tour ${userIndex + 1}`,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    tour_guide_id: user.id,
    status: tourStatuses[userIndex % tourStatuses.length],
  };

  const { data: createdTour, error: createTourError } = await supabase
    .from('tours')
    .insert(tourPayload)
    .select('id, tour_name, start_date, end_date, status')
    .single();

  if (createTourError) {
    throw createTourError;
  }

  return createdTour;
}

async function createExpenseReport(user, tour, userIndex) {
  const { data: existingReport, error: existingReportError } = await supabase
    .from('expense_reports')
    .select('id, transaction_date, transaction_memo')
    .eq('guide_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingReportError) {
    throw existingReportError;
  }

  if (existingReport.length > 0) {
    return existingReport[0];
  }

  const reportDate = daysAgo(14 + userIndex);
  const reportPayload = {
    tour_id: tour.id,
    guide_id: user.id,
    transaction_date: formatDate(reportDate),
    transaction_memo: createReportMemo(user.email, tour.tour_name),
    currency: currencies[userIndex % currencies.length],
    amount: 0,
    status: reportStatuses[userIndex % reportStatuses.length],
  };

  const { data: createdReport, error: createReportError } = await supabase
    .from('expense_reports')
    .insert(reportPayload)
    .select('id, transaction_date, transaction_memo')
    .single();

  if (createReportError) {
    throw createReportError;
  }

  return createdReport;
}

async function seedReportLines(report) {
  const lineCount = randomInt(5, 11);
  const reportDate = new Date(report.transaction_date);
  let totalAmount = 0;

  const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
    const line = buildLine(reportDate, lineIndex);
    totalAmount += line.amount;
    return {
      expense_report_id: report.id,
      ...line,
    };
  });

  const { error: deleteError } = await supabase
    .from('expense_report_lines')
    .delete()
    .eq('expense_report_id', report.id);

  if (deleteError) {
    throw deleteError;
  }

  const { error: insertError } = await supabase.from('expense_report_lines').insert(lines);

  if (insertError) {
    throw insertError;
  }

  const { error: updateError } = await supabase
    .from('expense_reports')
    .update({ amount: Number(totalAmount.toFixed(2)) })
    .eq('id', report.id);

  if (updateError) {
    throw updateError;
  }
}

async function main() {
  const { error: authError } = await supabase.auth.getSession();

  if (authError) {
    throw authError;
  }

  const users = await fetchAllUsers();

  if (users.length === 0) {
    console.log('No auth users found. Nothing to seed.');
    return;
  }

  for (const [index, user] of users.entries()) {
    const tour = await getOrCreateTour(user, index);
    const report = await createExpenseReport(user, tour, index);
    await seedReportLines(report);
    console.log(`Seeded report for ${user.email ?? user.id}`);
  }

  console.log(`Done. Seeded ${users.length} guide report(s).`);
}

main().catch((error) => {
  console.error('Seeding failed:');
  console.error(error);
  process.exit(1);
});