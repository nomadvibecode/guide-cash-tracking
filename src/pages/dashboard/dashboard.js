import { hasSupabaseConfig, supabase } from '../../services/supabase-client.js';
import { getCurrentSession } from '../../services/auth.js';
import { addExpenseTransaction, ensureGuideWorkspace } from '../../services/guide-workspace.js';

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

function directionClass(direction) {
  if (direction === 'money_in') {
    return 'bg-success-subtle text-success border-success-subtle';
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
  const defaultCurrency = defaultReport?.currency ?? 'USD';
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

async function loadReports() {
  const [reportsResult, linesResult] = await Promise.all([
    supabase
      .from('dashboard_expense_report_overview')
      .select('*')
      .order('start_date', { ascending: false })
      .order('transaction_date', { ascending: false }),
    supabase
      .from('expense_report_lines')
      .select('id, expense_report_id, line_date, description, category, direction, currency, amount')
      .order('line_date', { ascending: true }),
  ]);

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
    const reports = await loadReports();

    if (reports.length === 0) {
      if (!session?.user) {
        container.innerHTML = renderEmptyState();
        return;
      }

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

          ${session?.user ? renderTransactionPanel(reports) : ''}

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
          currencySelect.value = selectedReport.currency;
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