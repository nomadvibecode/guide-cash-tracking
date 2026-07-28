import './admin.css';
import adminFragment from './admin.html?raw';
import { getAllTours } from '../../services/tours.js';
import { getAllProfiles } from '../../services/profile.js';
import { getAllExpenseReports } from '../../services/expense-reports.js';
import { checkAdmin } from '../../services/auth.js';

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

  // Load Tours
  try {
    const tours = await getAllTours();
    toursLoading.style.display = 'none';
    
    if (tours && tours.length > 0) {
      toursList.innerHTML = tours.map(tour => `
        <tr>
          <td>${tour.tour_name || 'N/A'}</td>
          <td>${tour.start_date || 'N/A'}</td>
          <td>${tour.end_date || 'N/A'}</td>
          <td>${tour.status || 'N/A'}</td>
          <td>${tour.guest_count || 0}</td>
        </tr>
      `).join('');
      toursContainer.style.display = 'block';
    } else {
      toursList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No tours found</td></tr>';
      toursContainer.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading tours:', error);
    toursLoading.style.display = 'none';
    toursError.textContent = `Error loading tours: ${error.message}`;
    toursError.classList.remove('d-none');
  }

  // Load Guide Profiles
  try {
    const profiles = await getAllProfiles();
    profilesLoading.style.display = 'none';
    
    if (profiles && profiles.length > 0) {
      profilesList.innerHTML = profiles.map(profile => `
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
}

