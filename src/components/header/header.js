import { loadFragment } from '../../utils/fragment-loader.js';

import './header.css';

const headerFragmentUrl = new URL('./header.html', import.meta.url);

function setActiveNavigationLink(container, pathname) {
  container.querySelectorAll('[data-nav-link]').forEach((link) => {
    const linkUrl = new URL(link.getAttribute('href'), window.location.origin);
    const isActive = linkUrl.pathname === pathname;

    link.classList.toggle('active', isActive);
    link.toggleAttribute('aria-current', isActive);
  });
}

export async function renderHeader(container, pathname) {
  container.innerHTML = await loadFragment(headerFragmentUrl);
  setActiveNavigationLink(container, pathname);
}