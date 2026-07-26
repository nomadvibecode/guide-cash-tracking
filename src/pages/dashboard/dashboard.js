import { hasSupabaseConfig, supabase } from '../../services/supabase-client.js';

import './dashboard.css';

const moneyFormatterCache = new Map();

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatMoney(value, currency) {
  if (!moneyFormatterCache.has(currency)) {
    moneyFormatterCache.set(
      currency,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    );
  }

  return moneyFormatterCache.get(currency).format(Number(value));
}

function statusLabel(status) {
  return status.replaceAll('_', ' ');
}

function statusClass(status) {
  if (status === 'processed' || status === 'finished') {
    return 'bg-success-subtle text-success border-success-subtle';
  }

  if (status === 'submitted' || status === 'in_progress') {
    return 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
  }

  return 'bg-danger-subtle text-danger border-danger-subtle';
}

function summaryValue(value) {
  return value ?? '—';
}

function renderLoadingState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
          <p class="mt-3 mb-0 text-secondary">Loading seeded reports from Supabase...</p>
        </div>
      </div>
    </section>
  `;
}

function renderConfigError() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Supabase</p>
          <h1 class="h3 mb-3">Missing frontend environment variables</h1>
          <p class="mb-0 text-secondary">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your local <code>.env</code> file.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderEmptyState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Supabase</p>
          <h1 class="h3 mb-3">No seeded reports found</h1>
          <p class="mb-0 text-secondary">The database connection works, but the current project has no expense reports to show.</p>
        </div>
      </div>
    </section>
  `;
}

function renderErrorState(message) {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Supabase</p>
          <h1 class="h3 mb-3">Could not load seeded reports</h1>
          <p class="mb-0 text-secondary">${message}</p>
        </div>
      </div>
    </section>
  `;
}

function renderReportCard(report) {
  const lineRows = report.lines
    .map(
      (line) => `
        <tr>
          <td>${formatDate(line.line_date)}</td>
          <td>${line.description}</td>
          <td>${line.category}</td>
          <td class="text-end">${formatMoney(line.amount, report.currency)}</td>
        </tr>
      `,
    )
    .join('');

  const lineTotal = report.lines.reduce((total, line) => total + Number(line.amount), 0);

  return `
    <article class="page-panel dashboard-report-card p-4 p-lg-5">
      <div class="dashboard-report-title-block mb-4">
        <h2 class="dashboard-tour-title mb-2">${report.tour?.tour_name ?? 'Tour'}</h2>
        <p class="dashboard-report-memo mb-0">${report.transaction_memo}</p>
        <div class="dashboard-summary-grid mt-4">
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Guide</div>
            <div class="dashboard-summary-value">${summaryValue(report.guide?.display_name ?? report.guide?.email)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Tour</div>
            <div class="dashboard-summary-value">${summaryValue(report.tour?.tour_name)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Running balance</div>
            <div class="dashboard-summary-value">${formatMoney(report.amount ?? lineTotal, report.currency)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Status</div>
            <span class="badge rounded-pill border ${statusClass(report.status)}">${statusLabel(report.status)}</span>
          </div>
        </div>

        <div class="mt-3 mb-1 text-secondary small">
          ${formatDate(report.transaction_date)} · ${report.lines.length} expense lines
        </div>
      </div>

      <div class="table-responsive mt-4">
        <table class="table align-middle mb-0 dashboard-lines-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th class="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

async function loadReports() {
  const [reportsResult, toursResult, guideProfilesResult, linesResult] = await Promise.all([
    supabase.from('expense_reports').select('id, tour_id, guide_id, transaction_date, transaction_memo, currency, amount, status').order('transaction_date', { ascending: false }),
    supabase.from('tours').select('id, tour_name').order('start_date', { ascending: false }),
    supabase.from('guide_profiles').select('id, email, display_name'),
    supabase.from('expense_report_lines').select('id, expense_report_id, line_date, description, category, amount').order('line_date', { ascending: false }),
  ]);

  const firstError = reportsResult.error ?? toursResult.error ?? guideProfilesResult.error ?? linesResult.error;

  if (firstError) {
    throw firstError;
  }

  const toursById = new Map(toursResult.data.map((tour) => [tour.id, tour]));
  const guidesById = new Map(guideProfilesResult.data.map((guide) => [guide.id, guide]));
  const linesByReportId = new Map();

  for (const line of linesResult.data) {
    const currentLines = linesByReportId.get(line.expense_report_id) ?? [];
    currentLines.push(line);
    linesByReportId.set(line.expense_report_id, currentLines);
  }

  return reportsResult.data.map((report) => ({
    ...report,
    tour: toursById.get(report.tour_id) ?? null,
    guide: guidesById.get(report.guide_id) ?? null,
    lines: linesByReportId.get(report.id) ?? [],
  }));
}

export async function renderDashboardPage(container) {
  container.innerHTML = renderLoadingState();

  if (!hasSupabaseConfig || !supabase) {
    container.innerHTML = renderConfigError();
    return;
  }

  try {
    const reports = await loadReports();

    if (reports.length === 0) {
      container.innerHTML = renderEmptyState();
      return;
    }

    container.innerHTML = `
      <section class="page-section">
        <div class="container">
          <div class="mb-4 mb-lg-5">
            <p class="page-kicker mb-2">Supabase data</p>
            <h1 class="display-6 mb-3">Seeded expense reports</h1>
            <p class="lead text-secondary mb-0">The browser is now connected to Supabase and showing the seeded demo records.</p>
          </div>

          <div class="dashboard-report-list">
            ${reports.map(renderReportCard).join('')}
          </div>
        </div>
      </section>
    `;
  } catch (error) {
    container.innerHTML = renderErrorState(error?.message ?? 'Unknown Supabase error.');
  }
}