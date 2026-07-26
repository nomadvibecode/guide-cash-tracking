import { loadFragment } from '../../utils/fragment-loader.js';

import './project-tasks.css';

const projectTasksFragmentUrl = new URL('./project-tasks.html', import.meta.url);

export async function renderProjectTasksPage(container, params = {}) {
  container.innerHTML = await loadFragment(projectTasksFragmentUrl);

  const projectId = params.projectId ?? 'unknown';
  const projectIdNode = container.querySelector('[data-project-id]');

  if (projectIdNode) {
    projectIdNode.textContent = projectId;
  }
}