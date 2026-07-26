import './footer.css';

import footerFragment from './footer.html?raw';

export async function renderFooter(container) {
  container.innerHTML = footerFragment;
}