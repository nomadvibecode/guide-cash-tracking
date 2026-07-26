import { loadFragment } from '../../utils/fragment-loader.js';

import './running-balance.css';

const runningBalanceFragmentUrl = new URL('./running-balance.html', import.meta.url);

export async function renderRunningBalancePage(container, params = {}) {
  container.innerHTML = await loadFragment(runningBalanceFragmentUrl);

  const projectId = params.projectId ?? 'unknown';
  const projectIdNode = container.querySelector('[data-project-id]');

  if (projectIdNode) {
    projectIdNode.textContent = projectId;
  }
}