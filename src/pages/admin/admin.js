import './admin.css';
import adminFragment from './admin.html?raw';
import {
  getAllTours,
  addTour,
  updateTour,
  deleteTour,
  allocateGuidesToTour,
} from '../../services/tours.js';
import { getAllProfiles } from '../../services/profile.js';
import { getAllExpenseReports } from '../../services/expense-reports.js';
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

  let cachedTours = [];
  let cachedProfiles = [];

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

  // Load Guide Profiles
  try {
    cachedProfiles = await getAllProfiles();
    profilesLoading.style.display = 'none';

    if (cachedProfiles && cachedProfiles.length > 0) {
      profilesList.innerHTML = cachedProfiles.map(profile => `
        <tr>
          <td>${profile.display_name || 'N/A'}</td>
          <td>${profile.email || 'N/A'}</td>
          <td>${profile.phone || 'N/A'}</td>
          <td>${profile.bio || 'N/A'}</td>
        </tr>
      `).join('');
      profilesContainer.style.display = 'block';
    } else {
      profilesList.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No profiles found</td></tr>';
      profilesContainer.style.display = 'block';
    }

    populateGuideOptions();
  } catch (error) {
    console.error('Error loading profiles:', error);
    profilesLoading.style.display = 'none';
    profilesError.textContent = `Error loading profiles: ${error.message}`;
    profilesError.classList.remove('d-none');
  }

  // Load Expense Reports
  try {
    const reports = await getAllExpenseReports();
    expensesLoading.style.display = 'none';
    
    if (reports && reports.length > 0) {
      expensesList.innerHTML = reports.map(report => `
        <tr>
          <td>${report.transaction_memo || 'N/A'}</td>
          <td>${report.transaction_date || 'N/A'}</td>
          <td>${report.amount || 0}</td>
          <td>${report.currency || 'N/A'}</td>
          <td>${report.status || 'N/A'}</td>
        </tr>
      `).join('');
      expensesContainer.style.display = 'block';
    } else {
      expensesList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No expense reports found</td></tr>';
      expensesContainer.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading expense reports:', error);
    expensesLoading.style.display = 'none';
    expensesError.textContent = `Error loading expense reports: ${error.message}`;
    expensesError.classList.remove('d-none');
  }

  // Load Tours (after profiles so the guide select is populated)
  await loadTours();
}

