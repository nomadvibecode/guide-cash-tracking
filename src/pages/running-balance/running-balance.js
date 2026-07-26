import './running-balance.css';

import runningBalanceFragment from './running-balance.html?raw';

export async function renderRunningBalancePage(container, params = {}) {
  container.innerHTML = runningBalanceFragment;

  const projectId = params.projectId ?? 'unknown';
  const projectIdNode = container.querySelector('[data-project-id]');

  if (projectIdNode) {
    projectIdNode.textContent = projectId;
  }
}