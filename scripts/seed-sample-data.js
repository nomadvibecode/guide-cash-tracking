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
const currencies = ['USD', 'EUR', 'CHF'];
const categories = ['Transport', 'Meals', 'Accommodation', 'Supplies', 'Parking', 'Fuel', 'Tickets'];
const merchants = ['City Market', 'Transit Hub', 'Guest House', 'Road Stop', 'Cafe Central', 'Local Shuttle', 'Museum Desk'];
const moneyInReasons = ['Cash float from admin', 'Client reimbursement', 'Refund received', 'Local cash received'];
const moneyOutReasons = ['Breakfast for guests', 'Airport transfer', 'Museum tickets', 'Lunch stop', 'Fuel refill', 'Parking fee', 'Guide supplies', 'Emergency cash out'];
const newGuidePassword = 'demo1234';
const targetGuideEmails = Array.from({ length: 5 }, (_, index) => `guide-${index + 10}@example.com`);
const toursPerGuide = 3;
const reportLinesMin = 5;
const reportLinesMax = 11;

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
  return `Cash flow report for ${userEmail ?? 'guide'} on ${tourName}`;
}

function displayNameFromEmail(email) {
  const localPart = (email ?? 'guide').split('@')[0];
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildLine(reportDate, lineIndex, currency) {
  const amount = Number((randomInt(1200, 8500) / 100).toFixed(2));
  const lineDate = new Date(reportDate);
  lineDate.setDate(lineDate.getDate() - randomInt(0, 4));
  const direction = lineIndex === 0 || lineIndex % 5 === 0 ? 'money_in' : 'money_out';
  const isMoneyIn = direction === 'money_in';
  const category = isMoneyIn ? 'Cash flow' : pickRandomItem(categories);
  const description = isMoneyIn
    ? `${pickRandomItem(moneyInReasons)} - ${pickRandomItem(merchants)}`
    : `${pickRandomItem(merchants)} - ${pickRandomItem(categories)} ${lineIndex + 1}`;

  return {
    line_date: formatDate(lineDate),
    description,
    category,
    direction,
    currency,
    amount,
  };
}

function buildPhoneNumber(userIndex, accountIndex) {
  const suffix = String(1000 + userIndex * 2 + accountIndex).padStart(4, '0');
  return `+1 202 555 ${suffix}`;
}

function buildIban(prefix, userIndex, accountIndex) {
  const seed = String(100000 + userIndex * 10 + accountIndex).padStart(6, '0');
  return `${prefix}${seed}GUIDE${accountIndex}`.slice(0, 34);
}

function buildAttachment(reportId, attachmentIndex, userIndex, tourIndex) {
  const mimeType = attachmentIndex % 2 === 0 ? 'application/pdf' : 'image/jpeg';
  const extension = mimeType === 'application/pdf' ? 'pdf' : 'jpg';

  return {
    expense_report_id: reportId,
    file_name: `guide-${userIndex + 1}-tour-${tourIndex + 1}-attachment-${attachmentIndex + 1}.${extension}`,
    storage_path: `seeded/${reportId}/attachment-${attachmentIndex + 1}.${extension}`,
    mime_type: mimeType,
    file_size_bytes: randomInt(120_000, mimeType === 'application/pdf' ? 3_500_000 : 1_800_000),
  };
}

async function upsertTourGuides(tour, guides, ownerIndex, tourIndex) {
  const extraGuides = tourIndex === 0
    ? guides
        .filter((guide) => guide.id !== tour.tour_guide_id)
        .slice(ownerIndex % 2, ownerIndex % 2 + 2)
    : [];

  const assignments = [
    { tour_id: tour.id, guide_id: tour.tour_guide_id },
    ...extraGuides.map((guide) => ({ tour_id: tour.id, guide_id: guide.id })),
  ];

  const { error } = await supabase.from('tour_guides').upsert(assignments, {
    onConflict: 'tour_id,guide_id',
  });

  if (error) {
    throw error;
  }
}

async function createGuideUser(userIndex) {
  const email = `guide-${userIndex + 1}@example.com`;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: newGuidePassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayNameFromEmail(email),
      role: 'guide',
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
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

async function fetchOrCreateNewGuides() {
  const users = await fetchAllUsers();
  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const newGuides = [];

  for (const email of targetGuideEmails) {
    const existingGuide = usersByEmail.get(email);

    if (existingGuide) {
      newGuides.push(existingGuide);
      continue;
    }

    const guideNumber = Number(email.match(/guide-(\d+)@example\.com/)?.[1] ?? '10');
    const createdUser = await createGuideUser(guideNumber - 1);
    newGuides.push(createdUser);
    usersByEmail.set(createdUser.email, createdUser);
  }

  return newGuides;
}

async function getOrCreateTour(user, userIndex, tourIndex) {
  const { data: existingTours, error: toursError } = await supabase
    .from('tours')
    .select('id, tour_name, start_date, end_date, status, guest_count')
    .eq('tour_guide_id', user.id)
    .order('created_at', { ascending: true })
    .range(tourIndex, tourIndex);

  if (toursError) {
    throw toursError;
  }

  if (existingTours.length > 0) {
    return existingTours[0];
  }

  const startDate = daysAgo(21 + userIndex * 2);
  startDate.setDate(startDate.getDate() - tourIndex * 11);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + randomInt(3, 7));

  const tourPayload = {
    tour_name: `Sample tour ${userIndex + 1}.${tourIndex + 1}`,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    tour_guide_id: user.id,
    status: tourStatuses[userIndex % tourStatuses.length],
    guest_count: randomInt(6, 28),
  };

  const { data: createdTour, error: createTourError } = await supabase
    .from('tours')
    .insert(tourPayload)
    .select('id, tour_name, start_date, end_date, status, guest_count')
    .single();

  if (createTourError) {
    throw createTourError;
  }

  return createdTour;
}

async function upsertGuideProfile(user, userIndex) {
  const { error } = await supabase.from('guide_profiles').upsert({
    id: user.id,
    email: user.email,
    display_name: displayNameFromEmail(user.email),
    phone_numbers: `${buildPhoneNumber(userIndex, 0)}, ${buildPhoneNumber(userIndex, 1)}`,
    guiding_fee_bank_name: 'Guide Pay Bank',
    guiding_fee_account_iban: buildIban('GB', userIndex, 0),
    reimbursement_bank_name: 'Guide Pay Bank',
    reimbursement_account_iban: buildIban('GB', userIndex, 1),
    profile_image_path: `profiles/${user.id}/avatar.jpg`,
    profile_image_size_bytes: randomInt(140_000, 1_800_000),
  });

  if (error) {
    throw error;
  }
}

async function getOrCreateExpenseReport(user, tour, userIndex, tourIndex) {
  const { data: existingReport, error: existingReportError } = await supabase
    .from('expense_reports')
    .select('id, transaction_date, transaction_memo, amount, currency')
    .eq('guide_id', user.id)
    .eq('tour_id', tour.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingReportError) {
    throw existingReportError;
  }

  if (existingReport.length > 0) {
    return existingReport[0];
  }

  const reportDate = daysAgo(14 + userIndex + tourIndex * 2);
  reportDate.setDate(reportDate.getDate() - tourIndex * 10);
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
    .select('id, transaction_date, transaction_memo, amount, currency')
    .single();

  if (createReportError) {
    throw createReportError;
  }

  return createdReport;
}

async function seedReportLines(report, userIndex, tourIndex, startingBalance) {
  const lineCount = randomInt(reportLinesMin, reportLinesMax);
  const reportDate = new Date(report.transaction_date);
  let netChange = 0;

  let lines = Array.from({ length: lineCount }, (_, lineIndex) => {
    const line = buildLine(reportDate, lineIndex, report.currency);
    netChange += line.direction === 'money_in' ? line.amount : -line.amount;
    return {
      expense_report_id: report.id,
      ...line,
    };
  });

  const projectedBalance = Number((startingBalance + netChange).toFixed(2));

  if (projectedBalance < 0) {
    const topUpAmount = Number((Math.abs(projectedBalance) + randomInt(500, 2_500) / 100).toFixed(2));
    lines = [
      ...lines,
      {
        expense_report_id: report.id,
        line_date: formatDate(reportDate),
        description: 'Opening cash float top-up',
        category: 'Cash flow',
        direction: 'money_in',
        currency: report.currency,
        amount: topUpAmount,
      },
    ];
    netChange += topUpAmount;
  }

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

  const attachments = Array.from({ length: randomInt(1, 3) }, (_, attachmentIndex) =>
    buildAttachment(report.id, attachmentIndex, userIndex, tourIndex),
  );

  const { error: deleteAttachmentError } = await supabase
    .from('expense_report_attachments')
    .delete()
    .eq('expense_report_id', report.id);

  if (deleteAttachmentError) {
    throw deleteAttachmentError;
  }

  const { error: insertAttachmentError } = await supabase
    .from('expense_report_attachments')
    .insert(attachments);

  if (insertAttachmentError) {
    throw insertAttachmentError;
  }

  const { error: updateError } = await supabase
    .from('expense_reports')
    .update({ amount: Number((startingBalance + netChange).toFixed(2)) })
    .eq('id', report.id);

  if (updateError) {
    throw updateError;
  }

  return {
    netChange,
    lineCount: lines.length,
    attachmentCount: attachments.length,
  };
}

async function main() {
  const { error: authError } = await supabase.auth.getSession();

  if (authError) {
    throw authError;
  }

  const guides = await fetchOrCreateNewGuides();

  if (guides.length === 0) {
    console.log('No guides could be prepared. Nothing to seed.');
    return;
  }

  for (const [index, user] of guides.entries()) {
    await upsertGuideProfile(user, index);
    let runningBalance = Number((randomInt(2_500, 6_500) / 100).toFixed(2));

    for (let tourIndex = 0; tourIndex < toursPerGuide; tourIndex += 1) {
      const tour = await getOrCreateTour(user, index, tourIndex);
      await upsertTourGuides(tour, guides, index, tourIndex);

      if (tourIndex === 0) {
        const report = await getOrCreateExpenseReport(user, tour, index, tourIndex);
        const result = await seedReportLines(report, index, tourIndex, runningBalance);

        runningBalance = Number((runningBalance + result.netChange).toFixed(2));

        console.log(`Seeded ${user.email ?? user.id} / ${tour.tour_name} (${result.lineCount} lines, ${result.attachmentCount} attachments)`);
      }
    }
  }

  console.log(`Done. Seeded ${guides.length} new guide(s) with ${guides.length * toursPerGuide} tours and one report each.`);
}

main().catch((error) => {
  console.error('Seeding failed:');
  console.error(error);
  process.exit(1);
});