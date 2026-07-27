import { getCurrentSession } from '../../services/auth.js';
import { hasSupabaseConfig } from '../../services/supabase-client.js';
import {
  addExpenseReportLine,
  deleteExpenseReportLine,
  getTransactionTypeFromLine,
  loadExpenseReportsPageData,
  updateExpenseReportLine,
} from '../../services/expense-reports.js';

import './expense-reports.css';

const preferredCurrencyOrder = ['EUR', 'CHF', 'USD'];
const transactionTypes = [
  { value: 'expense', label: 'Expense', direction: 'money_out' },
  { value: 'atm_draw', label: 'ATM Draw', direction: 'money_in' },
  { value: 'wire_transfer', label: 'Wire Transfer', direction: 'money_in' },
];

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCurrencyAmount(amount, currency) {
  const numericAmount = Number(amount ?? 0);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${currency}`;
  }
}

function getSelectedTransactionType(transactionType) {
  return transactionTypes.find((type) => type.value === transactionType) ?? transactionTypes[0];
}

function renderLoadingState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
          <p class="mt-3 mb-0 text-secondary">Loading expense reports from Supabase...</p>
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
          <p class="page-kicker mb-2">Expense Reports</p>
          <h1 class="h3 mb-3">Missing frontend environment variables</h1>
          <p class="mb-0 text-secondary">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> before opening the expense reports page.</p>
        </div>
      </div>
    </section>
  `;
}

function renderSignedOutState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Expense Reports</p>
          <h1 class="h3 mb-3">Sign in to track expenses</h1>
          <p class="mb-0 text-secondary">Use your guide account to add dates, memos, currencies, and amounts to the selected report.</p>
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
          <p class="page-kicker mb-2">Expense Reports</p>
          <h1 class="h3 mb-3">No expense reports found</h1>
          <p class="mb-0 text-secondary">Create a tour first, then open an expense report to add line items in EUR, CHF, or USD.</p>
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
          <p class="page-kicker mb-2">Expense Reports</p>
          <h1 class="h3 mb-3">Could not load expense reports</h1>
          <p class="mb-0 text-secondary">${message}</p>
        </div>
      </div>
    </section>
  `;
}

function normalizeCurrencyOrder(currencies) {
  return [...currencies].sort((left, right) => {
    const leftOrder = preferredCurrencyOrder.indexOf(left.code);
    const rightOrder = preferredCurrencyOrder.indexOf(right.code);

    if (leftOrder === -1 && rightOrder === -1) {
      return left.code.localeCompare(right.code);
    }

    if (leftOrder === -1) {
      return 1;
    }

    if (rightOrder === -1) {
      return -1;
    }

    return leftOrder - rightOrder;
  });
}

function buildCurrencyTotals(lines) {
  return lines.reduce((totals, line) => {
    const currentValue = totals.get(line.currency) ?? 0;
    const signedAmount = line.direction === 'money_in'
      ? Number(line.amount ?? 0)
      : -Number(line.amount ?? 0);

    totals.set(line.currency, Number((currentValue + signedAmount).toFixed(2)));
    return totals;
  }, new Map());
}

function renderReportOptions(reports, selectedReportId) {
  return reports
    .map((report) => {
      const tourName = report.tours?.tour_name ?? 'Expense report';
      const tourStartDate = report.tours?.start_date;
      const tourEndDate = report.tours?.end_date;
      const tourRange = tourStartDate && tourEndDate
        ? `${formatDisplayDate(tourStartDate)} - ${formatDisplayDate(tourEndDate)}`
        : formatDisplayDate(report.transaction_date);
      const isSelected = report.id === selectedReportId;

      return `
        <option value="${report.id}" ${isSelected ? 'selected' : ''}>
          ${tourName} · ${tourRange}
        </option>
      `;
    })
    .join('');
}

function renderCurrencyOptions(currencies, selectedCurrency) {
  return currencies
    .map((currency, index) => `
      <option value="${currency.code}" ${currency.code === selectedCurrency || (!selectedCurrency && index === 0) ? 'selected' : ''}>${currency.code}</option>
    `)
    .join('');
}

function renderTransactionTypeOptions(selectedValue) {
  return transactionTypes
    .map((transactionType) => `
      <option value="${transactionType.value}" ${transactionType.value === selectedValue ? 'selected' : ''}>${transactionType.label}</option>
    `)
    .join('');
}

function renderTransactionTypeLabel(transactionType) {
  return getSelectedTransactionType(transactionType)?.label ?? 'Expense';
}

function transactionToneClass(line) {
  return line.direction === 'money_in'
    ? 'bg-success-subtle text-success border-success-subtle'
    : 'bg-danger-subtle text-danger border-danger-subtle';
}

function renderCurrencyTotals(totals) {
  if (totals.size === 0) {
    return '<p class="mb-0 text-secondary">No expense lines added yet.</p>';
  }

  return [...totals.entries()]
    .map(([currency, total]) => `
      <div class="expense-report-total-pill">
        <span class="expense-report-total-pill-label">${currency}</span>
        <strong>${formatCurrencyAmount(total, currency)}</strong>
      </div>
    `)
    .join('');
}

function renderLedgerSummary(totals) {
  return `
    <div class="expense-report-balance-banner expense-report-balance-side">
      <div>
        <div class="text-secondary small text-uppercase fw-semibold mb-1">Ledger balance</div>
        <div class="h5 fw-semibold mb-0">Money in adds, expenses subtract</div>
      </div>
      <div class="d-flex flex-column gap-2 w-100 mt-3">
        ${renderCurrencyTotals(totals)}
      </div>
    </div>
  `;
}

function renderLineRows(lines) {
  if (lines.length === 0) {
    return `
      <tr>
        <td colspan="6" class="py-4 text-center text-secondary">No expense lines yet. Add the first one using the form above.</td>
      </tr>
    `;
  }

  return lines
    .map((line) => `
      <tr data-line-id="${line.id}" class="${line.direction === 'money_in' ? 'expense-report-row-money-in' : ''}">
        <td>${formatDisplayDate(line.line_date)}</td>
        <td><span class="badge rounded-pill border ${transactionToneClass(line)}">${renderTransactionTypeLabel(getTransactionTypeFromLine(line))}</span></td>
        <td>${line.description}</td>
        <td><span class="badge rounded-pill border bg-light text-dark border-light-subtle">${line.currency}</span></td>
        <td class="text-end fw-semibold ${line.direction === 'money_in' ? 'expense-report-amount-in' : 'expense-report-amount-out'}">${formatCurrencyAmount(line.amount, line.currency)}</td>
        <td class="text-end">
          <div class="d-inline-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" type="button" data-edit-line data-line-id="${line.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-delete-line data-line-id="${line.id}">Delete</button>
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function renderEditLinePanel(editingLine, currencies) {
  if (!editingLine) {
    return '';
  }

  const lineType = getTransactionTypeFromLine(editingLine);
  const editCurrencyMarkup = renderCurrencyOptions(currencies, editingLine.currency);
  const editTransactionTypeMarkup = renderTransactionTypeOptions(lineType);

  return `
    <section class="page-panel p-4 p-lg-5 mb-4 expense-report-edit-panel">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <p class="page-kicker mb-2">Edit transaction</p>
          <h2 class="h4 mb-0">Update the selected line</h2>
        </div>
        <button class="btn btn-outline-secondary" type="button" data-cancel-edit>Cancel</button>
      </div>

      <form data-edit-form>
        <div class="row g-3 align-items-end">
          <div class="col-md-3">
            <label class="form-label" for="editExpenseDate">Date</label>
            <input class="form-control" id="editExpenseDate" name="expenseDate" type="date" value="${editingLine.line_date}" required />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="editExpenseType">Type</label>
            <select class="form-select" id="editExpenseType" name="expenseType" required>
              ${editTransactionTypeMarkup}
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="editExpenseCurrency">Currency</label>
            <select class="form-select" id="editExpenseCurrency" name="expenseCurrency" required>
              ${editCurrencyMarkup}
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="editExpenseAmount">Amount</label>
            <input class="form-control" id="editExpenseAmount" name="expenseAmount" type="number" min="0" step="0.01" value="${editingLine.amount}" required />
          </div>
          <div class="col-md-2 d-grid">
            <button class="btn btn-primary" type="submit">Save changes</button>
          </div>
        </div>
        <div class="row g-3 mt-0">
          <div class="col-12">
            <label class="form-label" for="editExpenseMemo">Memo</label>
            <input class="form-control" id="editExpenseMemo" name="expenseMemo" type="text" maxlength="120" value="${editingLine.description}" required />
          </div>
        </div>
        <div class="mt-3 text-secondary small" data-edit-status>Adjust the transaction and the running balance will refresh automatically.</div>
      </form>
    </section>
  `;
}

function renderExpenseReportsMarkup({ reports, currencies, selectedReportId, editingLineId }) {
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];
  const editingLine = selectedReport?.lines.find((line) => line.id === editingLineId) ?? null;
  const totals = buildCurrencyTotals(selectedReport?.lines ?? []);
  const selectedTourName = selectedReport?.tours?.tour_name ?? 'Expense report';
  const selectedTourStartDate = selectedReport?.tours?.start_date;
  const selectedTourEndDate = selectedReport?.tours?.end_date;
  const selectedTourRange = selectedTourStartDate && selectedTourEndDate
    ? `${formatDisplayDate(selectedTourStartDate)} - ${formatDisplayDate(selectedTourEndDate)}`
    : (selectedReport ? formatDisplayDate(selectedReport.transaction_date) : '');
  const reportSelectMarkup = renderReportOptions(reports, selectedReport?.id ?? selectedReportId);
  const currencySelectMarkup = renderCurrencyOptions(currencies, selectedReport?.currency);
  const transactionTypeSelectMarkup = renderTransactionTypeOptions('expense');
  const lineRowsMarkup = renderLineRows(selectedReport?.lines ?? []);
  return `
    <section class="page-section">
      <div class="container">
        <div class="mb-4 mb-lg-5">
          <p class="page-kicker mb-2">Supabase data</p>
          <h1 class="display-6 mb-3">Expense Reports</h1>
          <p class="lead text-secondary mb-0">Track each expense as a line item and mix EUR, CHF, and USD inside the same report.</p>
        </div>

        <div class="page-panel expense-report-panel p-4 p-lg-5">
          <div class="row g-4 align-items-start">
            <div class="col-lg-6">
              <label class="form-label" for="expenseReportSelect">Select report</label>
              <select class="form-select form-select-lg" id="expenseReportSelect" data-expense-report-select>
                ${reportSelectMarkup}
              </select>
              <div class="mt-2 text-secondary small">
                <span class="fw-semibold text-dark">Selected tour:</span> ${selectedTourName} · ${selectedTourRange}
              </div>
            </div>

            <div class="col-lg-6 d-flex justify-content-lg-end">
              ${renderLedgerSummary(totals)}
            </div>
          </div>

          <div class="row g-4 mt-1 align-items-start">
            <div class="col-lg-8">
              <div class="expense-report-summary-item expense-report-summary-item-wide">
                <span class="text-secondary small text-uppercase fw-semibold">Memo</span>
                <div class="fw-semibold">${selectedReport?.transaction_memo ?? 'No memo'}</div>
              </div>
            </div>

            <div class="col-lg-4 d-flex align-items-start justify-content-lg-end">
              <div class="expense-report-summary-item expense-report-summary-item-compact">
                <span class="text-secondary small text-uppercase fw-semibold">Transactions</span>
                <div class="fw-semibold">${selectedReport?.lines.length ?? 0}</div>
              </div>
            </div>
          </div>

          ${renderEditLinePanel(editingLine, currencies)}

          <form class="mt-4" data-expense-form>
            <div class="expense-report-entry-grid">
              <div class="expense-report-entry-cell">
                <label class="form-label" for="expenseDate">Date</label>
                <input class="form-control" id="expenseDate" name="expenseDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
              </div>
              <div class="expense-report-entry-cell">
                <label class="form-label" for="expenseType">Type</label>
                <select class="form-select" id="expenseType" name="expenseType" required>
                  ${transactionTypeSelectMarkup}
                </select>
              </div>
              <div class="expense-report-entry-cell">
                <label class="form-label" for="expenseMemo">Memo</label>
                <input class="form-control" id="expenseMemo" name="expenseMemo" type="text" maxlength="120" placeholder="Lunch with clients" required />
              </div>
              <div class="expense-report-entry-cell">
                <label class="form-label" for="expenseCurrency">Currency</label>
                <select class="form-select" id="expenseCurrency" name="expenseCurrency" required>
                  ${currencySelectMarkup}
                </select>
              </div>
              <div class="expense-report-entry-cell">
                <label class="form-label" for="expenseAmount">Amount</label>
                <input class="form-control" id="expenseAmount" name="expenseAmount" type="number" min="0" step="0.01" placeholder="0.00" required />
              </div>
              <div class="expense-report-entry-cell expense-report-entry-action">
                <button class="btn btn-primary" type="submit">Add</button>
              </div>
            </div>
            <div class="mt-3 text-secondary small" data-expense-status>Each expense line keeps its own currency, so one report can mix EUR, CHF, and USD entries.</div>
          </form>

          <div class="table-responsive mt-4">
            <table class="table align-middle mb-0 expense-report-table">
              <thead>
                <tr>
                  <th style="width: 16rem;">Date</th>
                  <th style="width: 10rem;">Type</th>
                  <th style="width: 28rem;">Memo</th>
                  <th style="width: 7rem;">Currency</th>
                  <th class="text-end" style="width: 9rem;">Amount</th>
                  <th class="text-end" style="width: 10rem;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${lineRowsMarkup}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;
}

export async function renderExpenseReportsPage(container, params = {}) {
  if (!hasSupabaseConfig) {
    container.innerHTML = renderConfigError();
    return;
  }

  container.innerHTML = renderLoadingState();

  try {
    const session = await getCurrentSession();

    if (!session?.user) {
      container.innerHTML = renderSignedOutState();
      return;
    }

    const { reports, currencies } = await loadExpenseReportsPageData(session.user.id);

    if (reports.length === 0) {
      container.innerHTML = renderEmptyState();
      return;
    }

    const preferredReportId = params.reportId && reports.some((report) => report.id === params.reportId)
      ? params.reportId
      : reports[0].id;

    let selectedReportId = preferredReportId;
    let editingLineId = null;

    const rerender = () => {
      container.innerHTML = renderExpenseReportsMarkup({
        reports,
        currencies: normalizeCurrencyOrder(currencies),
        selectedReportId,
        editingLineId,
      });

      const reportSelect = container.querySelector('[data-expense-report-select]');
      const form = container.querySelector('[data-expense-form]');
      const status = container.querySelector('[data-expense-status]');
      const editForm = container.querySelector('[data-edit-form]');
      const editStatus = container.querySelector('[data-edit-status]');
      const expenseDate = container.querySelector('#expenseDate');
      const expenseType = container.querySelector('#expenseType');
      const expenseCurrency = container.querySelector('#expenseCurrency');
      const expenseMemo = container.querySelector('#expenseMemo');
      const expenseAmount = container.querySelector('#expenseAmount');
      const editExpenseDate = container.querySelector('#editExpenseDate');
      const editExpenseType = container.querySelector('#editExpenseType');
      const editExpenseCurrency = container.querySelector('#editExpenseCurrency');
      const editExpenseMemo = container.querySelector('#editExpenseMemo');
      const editExpenseAmount = container.querySelector('#editExpenseAmount');

      container.querySelector('[data-cancel-edit]')?.addEventListener('click', () => {
        editingLineId = null;
        rerender();
      });

      container.querySelectorAll('[data-edit-line]').forEach((button) => {
        button.addEventListener('click', () => {
          editingLineId = button.dataset.lineId;
          rerender();
        });
      });

      container.querySelectorAll('[data-delete-line]').forEach((button) => {
        button.addEventListener('click', async () => {
          const lineId = button.dataset.lineId;
          const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];
          const line = selectedReport?.lines.find((entry) => entry.id === lineId);

          if (!line || !window.confirm(`Delete ${line.category} on ${formatDisplayDate(line.line_date)}?`)) {
            return;
          }

          button.disabled = true;

          try {
            await deleteExpenseReportLine({ lineId, reportId: selectedReportId });
            editingLineId = null;
            await renderExpenseReportsPage(container, { reportId: selectedReportId });
          } catch (error) {
            button.disabled = false;
            status.textContent = error?.message ?? 'Could not delete the expense line.';
          }
        });
      });

      reportSelect?.addEventListener('change', () => {
        selectedReportId = reportSelect.value;
        editingLineId = null;
        rerender();
      });

      form?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const memo = expenseMemo.value.trim();
        const lineDate = expenseDate.value;
        const transactionType = expenseType.value;
        const currency = expenseCurrency.value;
        const amount = Number(expenseAmount.value);
        const selectedTransactionType = getSelectedTransactionType(transactionType);
        const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];

        if (!memo || !lineDate || !currency || !selectedTransactionType || !Number.isFinite(amount) || amount <= 0) {
          status.textContent = 'Enter a valid date, memo, currency, and amount.';
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        status.textContent = 'Saving expense line...';

        try {
          await addExpenseReportLine({
            reportId: selectedReportId,
            lineDate,
            memo,
            currency,
            amount,
            transactionType: selectedTransactionType.value,
          });

          await renderExpenseReportsPage(container, { reportId: selectedReportId });
        } catch (error) {
          status.textContent = error?.message ?? 'Could not save the expense line.';
          submitButton.disabled = false;
        }
      });

      editForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];
        const editingLine = selectedReport?.lines.find((line) => line.id === editingLineId);
        const memo = editExpenseMemo.value.trim();
        const lineDate = editExpenseDate.value;
        const transactionType = editExpenseType.value;
        const currency = editExpenseCurrency.value;
        const amount = Number(editExpenseAmount.value);

        if (!editingLine || !memo || !lineDate || !currency || !Number.isFinite(amount) || amount <= 0) {
          editStatus.textContent = 'Enter a valid date, memo, currency, and amount.';
          return;
        }

        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        editStatus.textContent = 'Updating expense line...';

        try {
          await updateExpenseReportLine({
            lineId: editingLine.id,
            reportId: selectedReportId,
            lineDate,
            memo,
            currency,
            amount,
            transactionType,
          });

          editingLineId = null;
          await renderExpenseReportsPage(container, { reportId: selectedReportId });
        } catch (error) {
          editStatus.textContent = error?.message ?? 'Could not update the expense line.';
          submitButton.disabled = false;
        }
      });
    };

    rerender();
  } catch (error) {
    container.innerHTML = renderErrorState(error?.message ?? 'Unknown Supabase error.');
  }
}