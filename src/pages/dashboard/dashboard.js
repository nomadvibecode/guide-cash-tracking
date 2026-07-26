import { hasSupabaseConfig, supabase } from '../../services/supabase-client.js';
import { getCurrentSession } from '../../services/auth.js';
import { loadToursPageData } from '../../services/tours.js';
import { addExpenseTransaction, ensureGuideWorkspace } from '../../services/guide-workspace.js';

import './dashboard.css';

const moneyFormatterCache = new Map();

function normalizeCurrencyCode(currency) {
  const normalized = String(currency ?? '').trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'USD';
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatMoney(value, currency) {
  const normalizedCurrency = normalizeCurrencyCode(currency);

  if (!moneyFormatterCache.has(normalizedCurrency)) {
    moneyFormatterCache.set(
      normalizedCurrency,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: normalizedCurrency,
        maximumFractionDigits: 2,
      }),
    );
  }

  return moneyFormatterCache.get(normalizedCurrency).format(Number(value));
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

function directionClass(direction) {
  if (direction === 'money_in') {
    return 'bg-success-subtle text-success border-success-subtle';
  }

  return 'bg-danger-subtle text-danger border-danger-subtle';
}

function summaryValue(value) {
  return value ?? '—';
}

function displayNameFromEmail(email) {
  const localPart = (email ?? 'guide').split('@')[0];

  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitToursByStatus(tours) {
  return tours.reduce(
    (groups, tour) => {
      groups[tour.status] ??= [];
      groups[tour.status].push(tour);
      return groups;
    },
    {
      not_started: [],
      in_progress: [],
      finished: [],
    },
  );
}

function countFinishedTours(tours) {
  return tours.filter((tour) => tour.status === 'finished').length;
}

function buildTourPieData(tours) {
  const total = tours.length;
  const finished = countFinishedTours(tours);
  const remaining = Math.max(total - finished, 0);
  const finishedShare = total > 0 ? finished / total : 0;

  return { total, finished, remaining, finishedShare };
}

function buildCurrencySummaries(reports) {
  const today = new Date().toISOString().slice(0, 10);
  const summariesByCurrency = new Map();

  for (const report of reports) {
    for (const line of report.lines ?? []) {
      if (line.line_date > today) {
        continue;
      }

      const currency = normalizeCurrencyCode(line.currency ?? report.currency ?? 'USD');
      const currentSummary = summariesByCurrency.get(currency) ?? {
        currency,
        moneyIn: 0,
        expenses: 0,
        transactionCount: 0,
      };

      const amount = Number(line.amount) || 0;
      currentSummary.transactionCount += 1;

      if (line.direction === 'money_in') {
        currentSummary.moneyIn += amount;
      } else {
        currentSummary.expenses += amount;
      }

      summariesByCurrency.set(currency, currentSummary);
    }
  }

  return [...summariesByCurrency.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}

function renderTourPieChart(tours, reports) {
  const { total, finished, remaining, finishedShare } = buildTourPieData(tours);
  const angle = `${(finishedShare * 360).toFixed(2)}deg`;

  return `
    <section class="page-section pt-0">
      <div class="container">
        <div class="row g-4 align-items-stretch mb-4">
          <div class="col-12 col-xl-5">
            <div class="page-panel p-4 p-lg-5 h-100 dashboard-insight-card">
              <p class="page-kicker mb-2">Tour overview</p>
              <h2 class="h4 mb-3">Total tours vs tours finished</h2>
              <div class="dashboard-pie-wrap">
                <div class="dashboard-pie-chart" style="--dashboard-chart-angle: ${angle};">
                  <div class="dashboard-pie-chart-center">
                    <div class="dashboard-pie-chart-value">${finished}/${total}</div>
                    <div class="dashboard-pie-chart-label text-secondary">Finished</div>
                  </div>
                </div>
                <div class="dashboard-pie-legend">
                  <div class="dashboard-pie-legend-item">
                    <span class="dashboard-pie-dot is-finished"></span>
                    <div>
                      <div class="dashboard-pie-legend-label">Finished tours</div>
                      <div class="dashboard-pie-legend-value">${finished}</div>
                    </div>
                  </div>
                  <div class="dashboard-pie-legend-item">
                    <span class="dashboard-pie-dot is-remaining"></span>
                    <div>
                      <div class="dashboard-pie-legend-label">Remaining tours</div>
                      <div class="dashboard-pie-legend-value">${remaining}</div>
                    </div>
                  </div>
                  <div class="dashboard-pie-legend-item dashboard-pie-legend-total">
                    <div>
                      <div class="dashboard-pie-legend-label">Total tours</div>
                      <div class="dashboard-pie-legend-value">${total}</div>
                    </div>
                    <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${Math.round(finishedShare * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-xl-7">
            <div class="page-panel p-4 p-lg-5 h-100 dashboard-insight-card">
              <p class="page-kicker mb-2">Currencies</p>
              <h2 class="h4 mb-3">Money-in vs expenses by currency</h2>
              <p class="text-secondary mb-4">Totals are calculated from your report lines up to today, so guides with multiple currencies see each one separately.</p>
              <div class="dashboard-currency-grid">
                ${buildCurrencySummaries(reports)
                  .map(
                    (summary) => `
                      <article class="dashboard-currency-card">
                        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div>
                            <p class="page-kicker mb-2">${summary.currency}</p>
                            <h3 class="h5 mb-0">${summary.transactionCount} transactions</h3>
                          </div>
                          <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${summary.currency}</span>
                        </div>
                        <div class="dashboard-currency-metrics">
                          <div>
                            <div class="dashboard-summary-label mb-1">Money in</div>
                            <div class="dashboard-currency-value text-success">${formatMoney(summary.moneyIn, summary.currency)}</div>
                          </div>
                          <div>
                            <div class="dashboard-summary-label mb-1">Expenses</div>
                            <div class="dashboard-currency-value text-danger">${formatMoney(summary.expenses, summary.currency)}</div>
                          </div>
                        </div>
                        <div class="dashboard-currency-net mt-3">
                          <span class="dashboard-summary-label">Net</span>
                          <span class="dashboard-currency-value">${formatMoney(summary.moneyIn - summary.expenses, summary.currency)}</span>
                        </div>
                      </article>
                    `,
                  )
                  .join('') || '<div class="text-secondary">No transactions have been recorded yet.</div>'}
              </div>
            </div>
          </div>
        </div>

        ${session?.user ? renderToursBoard(assignedTours, currentGuideName) : ''}

        ${session?.user ? renderTransactionPanel(reports) : ''}

        ${session?.user && !hasReports ? renderNoToursState() : ''}

        <div class="dashboard-report-list">
          ${reports.map(renderReportCard).join('')}
        </div>
      </div>
    </section>
  `;
}

function getTourDays(tour) {
  const start = new Date(tour.start_date);
  const end = new Date(tour.end_date);
  const diff = Math.round((end - start) / 86400000) + 1;

  return Number.isFinite(diff) && diff > 0 ? diff : 1;
}

function renderTourStatusLabel(status) {
  return status.replaceAll('_', ' ');
}

function renderTourStatusClass(status) {
  if (status === 'finished') {
    return 'bg-success-subtle text-success border-success-subtle';
  }

  if (status === 'in_progress') {
    return 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
  }

  return 'bg-danger-subtle text-danger border-danger-subtle';
}

function renderTourGuideName(assignment, ownerGuideId) {
  const guide = assignment.guide_profiles;
  const label = guide?.display_name ?? displayNameFromEmail(guide?.email);
  const tags = [];

  if (assignment.guide_id === ownerGuideId) {
    tags.push('owner');
  }

  return `${label}${tags.length > 0 ? ` · ${tags.join(', ')}` : ''}`;
}

function renderTourCard(tour) {
  const guideAssignments = [...(tour.tour_guides ?? [])].sort((left, right) => {
    if (left.guide_id === tour.tour_guide_id) {
      return -1;
    }

    if (right.guide_id === tour.tour_guide_id) {
      return 1;
    }

    return 0;
  });

  const guideCount = guideAssignments.length;
  const days = tour.tour_days ?? getTourDays(tour);

  return `
    <article class="tour-card">
      <div class="tour-card-header">
        <div>
          <h3 class="tour-card-title">${tour.tour_name}</h3>
          <div class="tour-card-meta mt-2">${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}</div>
        </div>
        <span class="badge rounded-pill border ${renderTourStatusClass(tour.status)}">${renderTourStatusLabel(tour.status)}</span>
      </div>

      <div class="d-flex flex-wrap gap-2 mt-3">
        <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${days} days</span>
        <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${guideCount} guides</span>
        <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${tour.guest_count} guests</span>
      </div>

      <div class="tour-guides">
        ${guideAssignments.map((assignment) => `<span class="tour-guide-chip ${assignment.guide_id === tour.tour_guide_id ? 'is-owner' : ''}">${renderTourGuideName(assignment, tour.tour_guide_id)}</span>`).join('')}
      </div>
    </article>
  `;
}

function renderToursBoard(tours, currentGuideName) {
  const groupedTours = splitToursByStatus(tours);

  return `
    <section class="page-section pt-0">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 mb-4">
          <p class="page-kicker mb-2">Tours</p>
          <h2 class="h4 mb-3">${currentGuideName}’s assigned tours</h2>
          <p class="mb-0 text-secondary">All tours you created or joined are grouped by status below.</p>
        </div>

        <div class="tour-status-board dashboard-tour-status-board">
          <section class="tour-status-column">
            <div class="tour-status-column-header">
              <div>
                <p class="page-kicker mb-2">Not started</p>
                <h3 class="h5 mb-1">Red status</h3>
              </div>
              <span class="tour-status-count">${groupedTours.not_started.length}</span>
            </div>
            <div class="tour-status-list">
              ${(groupedTours.not_started.map(renderTourCard).join('') || '<div class="tour-status-empty text-secondary">No tours in this status.</div>')}
            </div>
          </section>

          <section class="tour-status-column">
            <div class="tour-status-column-header">
              <div>
                <p class="page-kicker mb-2">In progress</p>
                <h3 class="h5 mb-1">Yellow status</h3>
              </div>
              <span class="tour-status-count">${groupedTours.in_progress.length}</span>
            </div>
            <div class="tour-status-list">
              ${(groupedTours.in_progress.map(renderTourCard).join('') || '<div class="tour-status-empty text-secondary">No tours in this status.</div>')}
            </div>
          </section>

          <section class="tour-status-column">
            <div class="tour-status-column-header">
              <div>
                <p class="page-kicker mb-2">Finished</p>
                <h3 class="h5 mb-1">Green status</h3>
              </div>
              <span class="tour-status-count">${groupedTours.finished.length}</span>
            </div>
            <div class="tour-status-list">
              ${(groupedTours.finished.map(renderTourCard).join('') || '<div class="tour-status-empty text-secondary">No tours in this status.</div>')}
            </div>
          </section>
        </div>
      </div>
    </section>
  `;
}

function renderNoToursState() {
  return `
    <section class="page-section pt-0">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Tours</p>
          <h2 class="h4 mb-3">No assigned tours yet</h2>
          <p class="mb-0 text-secondary">Use the Tours tab to join an existing tour or create your own tour.</p>
        </div>
      </div>
    </section>
  `;
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

function renderEmptyWorkspaceState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Guide workspace</p>
          <h1 class="h3 mb-3">Create your first report</h1>
          <p class="mb-4 text-secondary">Start with a starter tour and expense report, then add money-in and money-out transactions right away.</p>
          <button class="btn btn-primary btn-lg" type="button" data-create-starter-workspace>Create starter report</button>
        </div>
      </div>
    </section>
  `;
}

function renderTransactionPanel(reports) {
  const reportOptions = reports
    .map((report) => `<option value="${report.id}">${report.tour_name} · ${formatMoney(report.running_balance ?? report.amount ?? 0, report.currency)}</option>`)
    .join('');

  const defaultReport = reports[0];
  const defaultCurrency = normalizeCurrencyCode(defaultReport?.currency ?? 'USD');
  const today = new Date().toISOString().slice(0, 10);

  return `
    <section class="page-section pt-0">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 mb-4">
          <p class="page-kicker mb-2">New transaction</p>
          <h2 class="h4 mb-3">Add money-in or money-out to an expense report</h2>
          <form class="row g-3 align-items-end" data-transaction-form>
            <div class="col-12 col-lg-4">
              <label class="form-label" for="transactionReport">Expense report</label>
              <select class="form-select form-select-lg" id="transactionReport" name="reportId" required>
                ${reportOptions}
              </select>
            </div>
            <div class="col-6 col-lg-2">
              <label class="form-label" for="transactionDate">Date</label>
              <input class="form-control form-control-lg" id="transactionDate" name="transactionDate" type="date" value="${today}" required />
            </div>
            <div class="col-6 col-lg-2">
              <label class="form-label" for="transactionDirection">Type</label>
              <select class="form-select form-select-lg" id="transactionDirection" name="direction">
                <option value="money_out" selected>Money out</option>
                <option value="money_in">Money in</option>
              </select>
            </div>
            <div class="col-6 col-lg-2">
              <label class="form-label" for="transactionCurrency">Currency</label>
              <select class="form-select form-select-lg" id="transactionCurrency" name="currency" disabled>
                <option value="USD" ${defaultCurrency === 'USD' ? 'selected' : ''}>USD</option>
                <option value="EUR" ${defaultCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                <option value="CHF" ${defaultCurrency === 'CHF' ? 'selected' : ''}>CHF</option>
              </select>
            </div>
            <div class="col-6 col-lg-2">
              <label class="form-label" for="transactionAmount">Amount</label>
              <input class="form-control form-control-lg" id="transactionAmount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
            </div>
            <div class="col-12 col-lg-5">
              <label class="form-label" for="transactionDescription">Description</label>
              <input class="form-control form-control-lg" id="transactionDescription" name="description" type="text" placeholder="What was the money spent on?" maxlength="120" required />
            </div>
            <div class="col-12 col-lg-5">
              <label class="form-label" for="transactionCategory">Category</label>
              <input class="form-control form-control-lg" id="transactionCategory" name="category" type="text" placeholder="Meals, fuel, transport" maxlength="80" required />
            </div>
            <div class="col-12 col-lg-2 d-grid">
              <button class="btn btn-primary btn-lg py-3" type="submit">Add transaction</button>
            </div>
          </form>
          <p class="small text-secondary mt-3 mb-0" data-transaction-status></p>
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
          <td><span class="badge rounded-pill border ${directionClass(line.direction)}">${line.direction.replaceAll('_', ' ')}</span></td>
          <td>${line.currency ?? report.currency}</td>
          <td>${line.description}</td>
          <td>${line.category}</td>
          <td class="text-end">${formatMoney(line.amount, line.currency ?? report.currency)}</td>
        </tr>
      `,
    )
    .join('');

  const lineTotal = report.lines.reduce((total, line) => total + Number(line.amount), 0);

  return `
    <article class="page-panel dashboard-report-card p-4 p-lg-5">
      <div class="dashboard-report-title-block mb-4">
        <h2 class="dashboard-tour-title mb-2">${report.tour_name ?? 'Tour'}</h2>
        <p class="dashboard-report-memo mb-0">${report.transaction_memo}</p>
        <div class="dashboard-summary-grid mt-4">
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Guide</div>
            <div class="dashboard-summary-value">${summaryValue(report.display_name ?? report.email)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Tour</div>
            <div class="dashboard-summary-value">${summaryValue(report.tour_name)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Tour days</div>
            <div class="dashboard-summary-value">${summaryValue(report.tour_days)} days</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Guests</div>
            <div class="dashboard-summary-value">${summaryValue(report.guest_count)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Money in</div>
            <div class="dashboard-summary-value">${formatMoney(report.money_in_total, report.currency)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Money out</div>
            <div class="dashboard-summary-value">${formatMoney(report.money_out_total, report.currency)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Running balance</div>
            <div class="dashboard-summary-value">${formatMoney(report.running_balance ?? report.amount ?? lineTotal, report.currency)}</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Attachments</div>
            <div class="dashboard-summary-value">${summaryValue(report.attachment_count)} files</div>
          </div>
          <div class="dashboard-summary-item">
            <div class="dashboard-summary-label">Status</div>
            <span class="badge rounded-pill border ${statusClass(report.status)}">${statusLabel(report.status)}</span>
          </div>
        </div>

        <div class="mt-3 mb-1 text-secondary small">
          ${formatDate(report.transaction_date)} · ${report.line_count ?? report.lines.length} transaction lines
        </div>
      </div>

      <div class="table-responsive mt-4">
        <table class="table align-middle mb-0 dashboard-lines-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Currency</th>
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

async function loadReports(guideId = null) {
  let reportsQuery = supabase
    .from('dashboard_expense_report_overview')
    .select('*')
    .order('start_date', { ascending: false })
    .order('transaction_date', { ascending: false });

  let linesQuery = supabase
    .from('expense_report_lines')
    .select('id, expense_report_id, line_date, description, category, direction, currency, amount')
    .order('line_date', { ascending: true });

  if (guideId) {
    reportsQuery = reportsQuery.eq('guide_id', guideId);
  }

  const [reportsResult, linesResult] = await Promise.all([reportsQuery, linesQuery]);

  const firstError = reportsResult.error ?? linesResult.error;

  if (firstError) {
    throw firstError;
  }

  const linesByReportId = new Map();

  for (const line of linesResult.data) {
    const currentLines = linesByReportId.get(line.expense_report_id) ?? [];
    currentLines.push(line);
    linesByReportId.set(line.expense_report_id, currentLines);
  }

  return reportsResult.data.map((report) => ({
    ...report,
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
    const session = await getCurrentSession();
    const [reports, tours] = await Promise.all([
      loadReports(session?.user?.id ?? null),
      session?.user ? loadToursPageData() : Promise.resolve([]),
    ]);

    const assignedTours = session?.user
      ? tours.filter((tour) => (tour.tour_guides ?? []).some((assignment) => assignment.guide_id === session.user.id))
      : [];
    const currentGuideName = session?.user ? displayNameFromEmail(session.user.email) : 'Guide';
    const hasReports = reports.length > 0;

    if (session?.user && reports.length === 0 && assignedTours.length === 0) {
      container.innerHTML = renderEmptyWorkspaceState();

      const createStarterWorkspaceButton = container.querySelector('[data-create-starter-workspace]');

      createStarterWorkspaceButton?.addEventListener('click', async () => {
        createStarterWorkspaceButton.disabled = true;

        try {
          await ensureGuideWorkspace(session.user);
          await renderDashboardPage(container);
        } catch (error) {
          container.innerHTML = renderErrorState(error?.message ?? 'Could not create a starter workspace.');
        }
      });

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

          ${session?.user ? renderTourPieChart(assignedTours, reports) : ''}
          ${session?.user ? renderToursBoard(assignedTours, currentGuideName) : ''}
          ${session?.user ? renderTransactionPanel(reports) : ''}
          ${session?.user && !hasReports ? renderNoToursState() : ''}

          <div class="dashboard-report-list">
            ${reports.map(renderReportCard).join('')}
          </div>
        </div>
      </section>
    `;

    if (session?.user) {
      const transactionForm = container.querySelector('[data-transaction-form]');
      const transactionStatus = container.querySelector('[data-transaction-status]');
      const reportSelect = container.querySelector('#transactionReport');
      const currencySelect = container.querySelector('#transactionCurrency');
      const directionSelect = container.querySelector('#transactionDirection');
      const reportMap = new Map(reports.map((report) => [report.id, report]));

      const syncSelectedReportCurrency = () => {
        const selectedReport = reportMap.get(reportSelect.value);

        if (selectedReport) {
          currencySelect.value = normalizeCurrencyCode(selectedReport.currency);
        }
      };

      reportSelect?.addEventListener('change', syncSelectedReportCurrency);
      syncSelectedReportCurrency();

      transactionForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const selectedReport = reportMap.get(reportSelect.value);

        if (!selectedReport) {
          transactionStatus.textContent = 'Please choose an expense report.';
          return;
        }

        const amount = Number(transactionForm.amount.value);
        const description = transactionForm.description.value.trim();
        const category = transactionForm.category.value.trim();
        const direction = directionSelect.value;
        const transactionDate = transactionForm.transactionDate.value;
        const currency = currencySelect.value;

        if (!description || !category || !transactionDate || !Number.isFinite(amount) || amount <= 0) {
          transactionStatus.textContent = 'Fill in a valid date, description, category, and amount.';
          return;
        }

        transactionForm.querySelector('button[type="submit"]').disabled = true;
        transactionStatus.textContent = 'Saving transaction...';

        try {
          await addExpenseTransaction({
            reportId: selectedReport.id,
            currentAmount: Number(selectedReport.running_balance ?? selectedReport.amount ?? 0),
            transactionDate,
            description,
            category,
            direction,
            currency,
            amount,
          });

          await renderDashboardPage(container);
        } catch (error) {
          transactionStatus.textContent = error?.message ?? 'Could not save the transaction.';
          transactionForm.querySelector('button[type="submit"]').disabled = false;
        }
      });
    }
  } catch (error) {
    container.innerHTML = renderErrorState(error?.message ?? 'Unknown Supabase error.');
  }
}