import { loadFragment } from '../../utils/fragment-loader.js';

import './dashboard.css';

const dashboardFragmentUrl = new URL('./dashboard.html', import.meta.url);

export async function renderDashboardPage(container) {
  container.innerHTML = await loadFragment(dashboardFragmentUrl);
}