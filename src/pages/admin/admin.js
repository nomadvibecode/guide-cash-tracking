import './admin.css';
import adminFragment from './admin.html?raw';
import {
  getAllTours,
  addTour,
  updateTour,
  deleteTour,
  allocateGuidesToTour,
} from '../../services/tours.js';
import { getAllProfiles, adminUpdateProfile, deleteProfile } from '../../services/profile.js';
import {
  getAllExpenseReports,
  getExpenseReportCurrencies,
  adminAddExpenseReport,
  adminUpdateExpenseReport,
  deleteExpenseReport,
} from '../../services/expense-reports.js';
import {
  getExpenseReportDetails,
  getExpenseReportLines,
  addExpenseReportLine,
  updateExpenseReportLine,
  deleteExpenseReportLine,
} from '../../services/expense-reports.js';
import { checkAdmin } from '../../services/auth.js';
import { Modal } from 'bootstrap';

export async function renderAdminPage(container) {
  container.innerHTML = adminFragment;

  const isAdmin = await checkAdmin();
  if (!isAdmin) {
    window.location.href = '/';
    return;
  }

  // Tours
  const toursLoading = document.getElementById('tours-loading');
  const toursContainer = document.getElementById('tours-container');
  const toursList = document.getElementById('tours-list');
  const toursError = document.getElementById('tours-error');

  // Profiles
  const profilesLoading = document.getElementById('profiles-loading');
  const profilesContainer = document.getElementById('profiles-container');
  const profilesList = document.getElementById('profiles-list');
  const profilesError = document.getElementById('profiles-error');

  // Expenses
  const expensesLoading = document.getElementById('expenses-loading');
  const expensesContainer = document.getElementById('expenses-container');
  const expensesList = document.getElementById('expenses-list');
  const expensesError = document.getElementById('expenses-error');

  // Tour modal elements
  const tourModalElement = document.getElementById('tour-modal');
  const tourModal = new Modal(tourModalElement);
  const tourForm = document.getElementById('tour-form');
  const tourModalLabel = document.getElementById('tour-modal-label');
  const tourIdInput = document.getElementById('tour-id');
  const tourNameInput = document.getElementById('tour-name');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const statusInput = document.getElementById('status');
  const guestCountInput = document.getElementById('guest-count');
  const allocatedGuidesSelect = document.getElementById('allocated-guides');
  const addTourButton = document.getElementById('add-tour-button');

  // Profile modal elements
  const profileModalElement = document.getElementById('profile-modal');
  const profileModal = new Modal(profileModalElement);
  const profileForm = document.getElementById('profile-form');
  const profileIdInput = document.getElementById('profile-id');
  const profileEmailInput = document.getElementById('profile-email-input');
  const profileFirstNameInput = document.getElementById('profile-first-name');
  const profileLastNameInput = document.getElementById('profile-last-name');
  const profileDisplayNameInput = document.getElementById('profile-display-name-input');
  const profilePhoneInput = document.getElementById('profile-phone');
  const profileNotesInput = document.getElementById('profile-notes');

  // Expense report modal elements
  const expenseModalElement = document.getElementById('expense-modal');
  const expenseModal = new Modal(expenseModalElement);
  const expenseForm = document.getElementById('expense-form');
  const expenseModalLabel = document.getElementById('expense-modal-label');
  const expenseIdInput = document.getElementById('expense-id');
  const expenseTourSelect = document.getElementById('expense-tour');
  const expenseGuideSelect = document.getElementById('expense-guide');
  const expenseMemoInput = document.getElementById('expense-memo');
  const expenseDateInput = document.getElementById('expense-date');
  const expenseStatusInput = document.getElementById('expense-status');
  const expenseAmountInput = document.getElementById('expense-amount');
  const expenseCurrencyInput = document.getElementById('expense-currency');
  const addExpenseButton = document.getElementById('add-expense-button');

  // Expense report details modal
  const expenseReportDetailsModalElement = document.getElementById('expense-report-details-modal');
  const expenseReportDetailsModal = new Modal(expenseReportDetailsModalElement);
  const expenseReportDetailsContainer = document.getElementById('expense-report-details-container');
  const expenseReportLinesList = document.getElementById('expense-report-lines-list');
  const addExpenseLineButton = document.getElementById('add-expense-line-button');

  // Expense line modal
  const expenseLineModalElement = document.getElementById('expense-line-modal');
  const expenseLineModal = new Modal(expenseLineModalElement);
  const expenseLineForm = document.getElementById('expense-line-form');
  const expenseLineIdInput = document.getElementById('expense-line-id');
  const expenseReportIdForLineInput = document.getElementById('expense-report-id-for-line');
  const expenseLineDateInput = document.getElementById('expense-line-date');
  const expenseLineMerchantInput = document.getElementById('expense-line-merchant');
  const expenseLineCategoryInput = document.getElementById('expense-line-category');
  const expenseLineAmountInput = document.getElementById('expense-line-amount');
  const expenseLineCurrencyInput = document.getElementById('expense-line-currency');
  const expenseLineDescriptionInput = document.getElementById('expense-line-description');

  let cachedTours = [];
  let cachedProfiles = [];
  let cachedExpenseReports = [];
  let cachedCurrencies = [];

  function populateGuideOptions() {
    allocatedGuidesSelect.innerHTML = cachedProfiles
      .map((profile) => `<option value="${profile.id}">${profile.display_name || profile.email}</option>`)
      .join('');
  }

  function renderToursTable() {
    if (cachedTours.length > 0) {
      toursList.innerHTML = cachedTours.map((tour) => {
        const guideNames = (tour.tour_guides || [])
          .map((allocation) => allocation.guide_profiles?.display_name)
          .filter(Boolean)
          .join(', ') || 'N/A';

        return `
          <tr>
            <td>${tour.tour_name || 'N/A'}</td>
            <td>${tour.start_date || 'N/A'}</td>
            <td>${tour.end_date || 'N/A'}</td>
            <td>${tour.status || 'N/A'}</td>
            <td>${tour.guest_count || 0}</td>
            <td>${guideNames}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-secondary edit-tour-button" data-tour-id="${tour.id}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-tour-button" data-tour-id="${tour.id}">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      toursList.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No tours found</td></tr>';
    }
    toursContainer.style.display = 'block';
  }

  async function loadTours() {
    try {
      toursLoading.style.display = 'block';
      toursContainer.style.display = 'none';
      cachedTours = await getAllTours();
      toursLoading.style.display = 'none';
      renderToursTable();
    } catch (error) {
      console.error('Error loading tours:', error);
      toursLoading.style.display = 'none';
      toursError.textContent = `Error loading tours: ${error.message}`;
      toursError.classList.remove('d-none');
    }
  }

  function openAddTourModal() {
    tourModalLabel.textContent = 'Add Tour';
    tourForm.reset();
    tourIdInput.value = '';
    Array.from(allocatedGuidesSelect.options).forEach((option) => {
      option.selected = false;
    });
    tourModal.show();
  }

  function openEditTourModal(tourId) {
    const tour = cachedTours.find((t) => String(t.id) === String(tourId));
    if (!tour) {
      return;
    }

    tourModalLabel.textContent = 'Edit Tour';
    tourIdInput.value = tour.id;
    tourNameInput.value = tour.tour_name || '';
    startDateInput.value = tour.start_date || '';
    endDateInput.value = tour.end_date || '';
    statusInput.value = tour.status || 'not_started';
    guestCountInput.value = tour.guest_count || 0;

    const allocatedIds = (tour.tour_guides || []).map((allocation) => String(allocation.guide_id));
    Array.from(allocatedGuidesSelect.options).forEach((option) => {
      option.selected = allocatedIds.includes(option.value);
    });

    tourModal.show();
  }

  async function handleDeleteTour(tourId) {
    if (!confirm('Are you sure you want to delete this tour?')) {
      return;
    }

    try {
      await deleteTour(tourId);
      await loadTours();
    } catch (error) {
      alert(`Error deleting tour: ${error.message}`);
    }
  }

  async function handleTourFormSubmit(event) {
    event.preventDefault();

    const selectedGuideIds = Array.from(allocatedGuidesSelect.selectedOptions).map((option) => option.value);

    if (selectedGuideIds.length > 3) {
      alert('You can allocate a maximum of 3 guides per tour.');
      return;
    }

    const tourData = {
      tour_name: tourNameInput.value,
      start_date: startDateInput.value,
      end_date: endDateInput.value,
      status: statusInput.value,
      guest_count: Number(guestCountInput.value) || 0,
    };

    try {
      const tourId = tourIdInput.value;
      const savedTour = tourId
        ? await updateTour(tourId, tourData)
        : await addTour(tourData);

      await allocateGuidesToTour(savedTour.id, selectedGuideIds);
      tourModal.hide();
      await loadTours();
    } catch (error) {
      alert(`Error saving tour: ${error.message}`);
    }
  }

  addTourButton?.addEventListener('click', openAddTourModal);
  tourForm?.addEventListener('submit', handleTourFormSubmit);

  toursList.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-tour-button');
    if (editButton) {
      openEditTourModal(editButton.dataset.tourId);
      return;
    }

    const deleteButton = event.target.closest('.delete-tour-button');
    if (deleteButton) {
      handleDeleteTour(deleteButton.dataset.tourId);
    }
  });

  function renderProfilesTable() {
    if (cachedProfiles && cachedProfiles.length > 0) {
      profilesList.innerHTML = cachedProfiles.map(profile => `
        <tr>
          <td>${profile.display_name || 'N/A'}</td>
          <td>${profile.email || 'N/A'}</td>
          <td>${profile.phone_number || 'N/A'}</td>
          <td>${profile.notes || 'N/A'}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-secondary edit-profile-button" data-profile-id="${profile.id}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger delete-profile-button" data-profile-id="${profile.id}">Delete</button>
          </td>
        </tr>
      `).join('');
    } else {
      profilesList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No profiles found</td></tr>';
    }
    profilesContainer.style.display = 'block';
  }

  function openEditProfileModal(profileId) {
    const profile = cachedProfiles.find((p) => String(p.id) === String(profileId));
    if (!profile) {
      return;
    }

    profileIdInput.value = profile.id;
    profileEmailInput.value = profile.email || '';
    profileFirstNameInput.value = profile.first_name || '';
    profileLastNameInput.value = profile.last_name || '';
    profileDisplayNameInput.value = profile.display_name || '';
    profilePhoneInput.value = profile.phone_number || '';
    profileNotesInput.value = profile.notes || '';

    profileModal.show();
  }

  async function handleDeleteProfile(profileId) {
    if (!confirm('Are you sure you want to delete this guide profile? This will also remove their tour allocations.')) {
      return;
    }

    try {
      await deleteProfile(profileId);
      cachedProfiles = await getAllProfiles();
      renderProfilesTable();
      populateGuideOptions();
      renderExpenseReportsTable();
    } catch (error) {
      alert(`Error deleting profile: ${error.message}`);
    }
  }

  async function handleProfileFormSubmit(event) {
    event.preventDefault();

    const profileId = profileIdInput.value;
    const profileData = {
      first_name: profileFirstNameInput.value,
      last_name: profileLastNameInput.value,
      display_name: profileDisplayNameInput.value,
      phone_number: profilePhoneInput.value,
      notes: profileNotesInput.value,
    };

    try {
      await adminUpdateProfile(profileId, profileData);
      profileModal.hide();
      cachedProfiles = await getAllProfiles();
      renderProfilesTable();
      populateGuideOptions();
      renderToursTable();
      renderExpenseReportsTable();
    } catch (error) {
      alert(`Error saving profile: ${error.message}`);
    }
  }

  profileForm?.addEventListener('submit', handleProfileFormSubmit);

  profilesList.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-profile-button');
    if (editButton) {
      openEditProfileModal(editButton.dataset.profileId);
      return;
    }

    const deleteButton = event.target.closest('.delete-profile-button');
    if (deleteButton) {
      handleDeleteProfile(deleteButton.dataset.profileId);
    }
  });

  // Load Guide Profiles
  try {
    cachedProfiles = await getAllProfiles();
    profilesLoading.style.display = 'none';
    renderProfilesTable();
    populateGuideOptions();
  } catch (error) {
    console.error('Error loading profiles:', error);
    profilesLoading.style.display = 'none';
    profilesError.textContent = `Error loading profiles: ${error.message}`;
    profilesError.classList.remove('d-none');
  }

  // Load Expense Reports
  function populateExpenseFormOptions() {
    expenseTourSelect.innerHTML = cachedTours
      .map((tour) => `<option value="${tour.id}">${tour.tour_name}</option>`)
      .join('');

    expenseGuideSelect.innerHTML = cachedProfiles
      .map((profile) => `<option value="${profile.id}">${profile.display_name || profile.email}</option>`)
      .join('');

    expenseCurrencyInput.innerHTML = cachedCurrencies
      .map((currency) => `<option value="${currency.code}">${currency.code} - ${currency.label}</option>`)
      .join('');
  }

  function renderExpenseReportsTable() {
    if (cachedExpenseReports.length > 0) {
      expensesList.innerHTML = cachedExpenseReports.map((report) => {
        const guideName = cachedProfiles.find((profile) => profile.id === report.guide_id)?.display_name || 'N/A';

        return `
          <tr>
            <td>${report.tours?.tour_name || 'N/A'}</td>
            <td>${guideName}</td>
            <td>${report.transaction_memo || 'N/A'}</td>
            <td>${report.transaction_date || 'N/A'}</td>
            <td>${report.amount || 0}</td>
            <td>${report.currency || 'N/A'}</td>
            <td>${report.status || 'N/A'}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-info view-expense-details-button" data-expense-id="${report.id}">View Details</button>
              <button type="button" class="btn btn-sm btn-outline-secondary edit-expense-button" data-expense-id="${report.id}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-expense-button" data-expense-id="${report.id}">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      expensesList.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No expense reports found</td></tr>';
    }
    expensesContainer.style.display = 'block';
  }

  async function loadExpenseReports() {
    try {
      expensesLoading.style.display = 'block';
      expensesContainer.style.display = 'none';
      cachedExpenseReports = await getAllExpenseReports();
      expensesLoading.style.display = 'none';
      renderExpenseReportsTable();
    } catch (error) {
      console.error('Error loading expense reports:', error);
      expensesLoading.style.display = 'none';
      expensesError.textContent = `Error loading expense reports: ${error.message}`;
      expensesError.classList.remove('d-none');
    }
  }

  function openAddExpenseModal() {
    expenseModalLabel.textContent = 'Add Expense Report';
    expenseForm.reset();
    expenseIdInput.value = '';
    populateExpenseFormOptions();
    expenseModal.show();
  }

  function openEditExpenseModal(expenseId) {
    const report = cachedExpenseReports.find((r) => String(r.id) === String(expenseId));
    if (!report) {
      return;
    }

    populateExpenseFormOptions();
    expenseModalLabel.textContent = 'Edit Expense Report';
    expenseIdInput.value = report.id;
    expenseTourSelect.value = report.tour_id;
    expenseGuideSelect.value = report.guide_id;
    expenseMemoInput.value = report.transaction_memo || '';
    expenseDateInput.value = report.transaction_date || '';
    expenseStatusInput.value = report.status || 'not_submitted';
    expenseAmountInput.value = report.amount || 0;
    expenseCurrencyInput.value = report.currency || '';

    expenseModal.show();
  }

  async function handleDeleteExpenseReport(expenseId) {
    if (!confirm('Are you sure you want to delete this expense report?')) {
      return;
    }

    try {
      await deleteExpenseReport(expenseId);
      await loadExpenseReports();
    } catch (error) {
      alert(`Error deleting expense report: ${error.message}`);
    }
  }

  async function handleExpenseFormSubmit(event) {
    event.preventDefault();

    const expenseData = {
      tour_id: expenseTourSelect.value,
      guide_id: expenseGuideSelect.value,
      transaction_memo: expenseMemoInput.value,
      transaction_date: expenseDateInput.value,
      status: expenseStatusInput.value,
      amount: Number(expenseAmountInput.value) || 0,
      currency: expenseCurrencyInput.value,
    };

    try {
      const expenseId = expenseIdInput.value;
      if (expenseId) {
        await adminUpdateExpenseReport(expenseId, expenseData);
      } else {
        await adminAddExpenseReport(expenseData);
      }
      expenseModal.hide();
      await loadExpenseReports();
    } catch (error) {
      alert(`Error saving expense report: ${error.message}`);
    }
  }

  addExpenseButton?.addEventListener('click', openAddExpenseModal);
  expenseForm?.addEventListener('submit', handleExpenseFormSubmit);

  expensesList.addEventListener('click', (event) => {
    const viewDetailsButton = event.target.closest('.view-expense-details-button');
    if (viewDetailsButton) {
      openExpenseReportDetailsModal(viewDetailsButton.dataset.expenseId);
      return;
    }

    const editButton = event.target.closest('.edit-expense-button');
    if (editButton) {
      openEditExpenseModal(editButton.dataset.expenseId);
      return;
    }

    const deleteButton = event.target.closest('.delete-expense-button');
    if (deleteButton) {
      handleDeleteExpenseReport(deleteButton.dataset.expenseId);
    }
  });

  const viewDetailsButton = event.target.closest('.view-expense-details-button');
    if (viewDetailsButton) {
      openExpenseReportDetailsModal(viewDetailsButton.dataset.expenseId);
      return;
    }

  try {
    cachedCurrencies = await getExpenseReportCurrencies();
  } catch (error) {
    console.error('Error loading currencies:', error);
  }

  // Load Tours (needed for the expense report tour select as well)
  await loadTours();
  await loadExpenseReports();
}

async function openExpenseReportDetailsModal(expenseId) {
  expenseReportDetailsModal.show();
  expenseReportDetailsContainer.style.display = 'none';
  document.getElementById('expense-report-details-loading').style.display = 'block';

  try {
    const report = await getExpenseReportDetails(expenseId);
    expenseReportDetailsContainer.innerHTML = `
      <p><strong>Tour:</strong> ${report.tours.tour_name}</p>
      <p><strong>Guide:</strong> ${report.guide_profiles.display_name}</p>
      <p><strong>Memo:</strong> ${report.transaction_memo}</p>
      <p><strong>Status:</strong> ${report.status}</p>
    `;
    expenseReportDetailsContainer.style.display = 'block';
    document.getElementById('expense-report-details-loading').style.display = 'none';

    expenseReportIdForLineInput.value = expenseId;
    await loadExpenseReportLines(expenseId);
  } catch (error) {
    console.error('Error loading expense report details:', error);
    document.getElementById('expense-report-details-loading').style.display = 'none';
  }
}

async function loadExpenseReportLines(reportId) {
  document.getElementById('expense-report-lines-loading').style.display = 'block';
  document.getElementById('expense-report-lines-container').style.display = 'none';
  try {
    const lines = await getExpenseReportLines(reportId);
    renderExpenseReportLines(lines);
    document.getElementById('expense-report-lines-loading').style.display = 'none';
    document.getElementById('expense-report-lines-container').style.display = 'block';
  } catch (error) {
    console.error('Error loading expense report lines:', error);
    document.getElementById('expense-report-lines-loading').style.display = 'none';
    document.getElementById('expense-report-lines-error').textContent = `Error loading lines: ${error.message}`;
    document.getElementById('expense-report-lines-error').classList.remove('d-none');
  }
}

function renderExpenseReportLines(lines) {
  expenseReportLinesList.innerHTML = lines.map(line => `
    <tr>
      <td>${line.transaction_date}</td>
      <td>${line.merchant}</td>
      <td>${line.category}</td>
      <td>${line.amount}</td>
      <td>${line.currency}</td>
      <td>${line.description}</td>
      <td>
        <button class="btn btn-sm btn-secondary edit-expense-line-button" data-line-id="${line.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-expense-line-button" data-line-id="${line.id}">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openAddExpenseLineModal() {
  expenseLineForm.reset();
  expenseLineIdInput.value = '';
  expenseLineModal.show();
}

function openEditExpenseLineModal(lineId) {
  const reportId = expenseReportIdForLineInput.value;
  getExpenseReportLines(reportId).then(lines => {
    const line = lines.find(l => String(l.id) === String(lineId));
    if (line) {
      expenseLineIdInput.value = line.id;
      expenseLineDateInput.value = line.transaction_date;
      expenseLineMerchantInput.value = line.merchant;
      expenseLineCategoryInput.value = line.category;
      expenseLineAmountInput.value = line.amount;
      expenseLineCurrencyInput.value = line.currency;
      expenseLineDescriptionInput.value = line.description;
      expenseLineModal.show();
    }
  });
}

async function handleExpenseLineFormSubmit(event) {
  event.preventDefault();
  const lineId = expenseLineIdInput.value;
  const reportId = expenseReportIdForLineInput.value;
  const lineData = {
    expense_report_id: reportId,
    transaction_date: expenseLineDateInput.value,
    merchant: expenseLineMerchantInput.value,
    category: expenseLineCategoryInput.value,
    amount: parseFloat(expenseLineAmountInput.value),
    currency: expenseLineCurrencyInput.value,
    description: expenseLineDescriptionInput.value,
  };

  try {
    if (lineId) {
      await updateExpenseReportLine(lineId, lineData);
    } else {
      await addExpenseReportLine(lineData);
    }
    expenseLineModal.hide();
    await loadExpenseReportLines(reportId);
  } catch (error) {
    alert(`Error saving expense line: ${error.message}`);
  }
}

async function handleDeleteExpenseLine(lineId) {
  if (!confirm('Are you sure you want to delete this expense line?')) {
    return;
  }
  try {
    await deleteExpenseReportLine(lineId);
    const reportId = expenseReportIdForLineInput.value;
    await loadExpenseReportLines(reportId);
  } catch (error) {
    alert(`Error deleting expense line: ${error.message}`);
  }
}

addExpenseLineButton.addEventListener('click', openAddExpenseLineModal);
expenseLineForm.addEventListener('submit', handleExpenseLineFormSubmit);
expenseReportLinesList.addEventListener('click', (event) => {
  if (event.target.classList.contains('edit-expense-line-button')) {
    openEditExpenseLineModal(event.target.dataset.lineId);
  }
  if (event.target.classList.contains('delete-expense-line-button')) {
    handleDeleteExpenseLine(event.target.dataset.lineId);
  }
});

