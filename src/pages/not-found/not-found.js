import { loadFragment } from '../../utils/fragment-loader.js';

import './not-found.css';

const notFoundFragmentUrl = new URL('./not-found.html', import.meta.url);

export async function renderNotFoundPage(container, params = {}) {
  container.innerHTML = await loadFragment(notFoundFragmentUrl);

  const pathNode = container.querySelector('[data-pathname]');

  if (pathNode) {
    pathNode.textContent = params.pathname ?? window.location.pathname;
  }
}