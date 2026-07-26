import { loadFragment } from '../../utils/fragment-loader.js';
import { getCurrentSession, signOutCurrentUser } from '../../services/auth.js';

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

  const authItem = container.querySelector('[data-auth-link]')?.closest('.nav-item');
  const loggedInItem = container.querySelector('[data-logged-in-only]');
  const logoutButton = container.querySelector('[data-logout-button]');

  try {
    const session = await getCurrentSession();

    if (session) {
      authItem?.classList.add('d-none');
      loggedInItem?.classList.remove('d-none');

      logoutButton?.addEventListener('click', async () => {
        logoutButton.disabled = true;

        try {
          const { error } = await signOutCurrentUser();

          if (error) {
            throw error;
          }

          window.location.replace('/');
        } catch {
          logoutButton.disabled = false;
        }
      });

      return;
    }
  } catch {
    // Render the logged-out state when the session cannot be read.
  }

  authItem?.classList.remove('d-none');
  loggedInItem?.classList.add('d-none');
}