import './not-found.css';

import notFoundFragment from './not-found.html?raw';

export async function renderNotFoundPage(container, params = {}) {
  container.innerHTML = notFoundFragment;

  const pathNode = container.querySelector('[data-pathname]');

  if (pathNode) {
    pathNode.textContent = params.pathname ?? window.location.pathname;
  }
}