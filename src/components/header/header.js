import { getCurrentSession, signOutCurrentUser, checkAdmin } from '../../services/auth.js';
import { supabase } from '../../services/supabase-client.js';

import './header.css';

import headerFragment from './header.html?raw';

function setActiveNavigationLink(container, pathname) {
  container.querySelectorAll('[data-nav-link]').forEach((link) => {
    const linkUrl = new URL(link.getAttribute('href'), window.location.origin);
    const isActive = linkUrl.pathname === pathname;

    link.classList.toggle('active', isActive);
    link.toggleAttribute('aria-current', isActive);
  });
}

function fallbackDisplayName(email) {
  const localPart = (email ?? 'User').split('@')[0];

  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function getSignedInGuideName(session) {
  const email = session?.user?.email ?? '';

  if (!supabase || !session?.user?.id) {
    return fallbackDisplayName(email);
  }

  const { data } = await supabase
    .from('guide_profiles')
    .select('display_name')
    .eq('id', session.user.id)
    .maybeSingle();

  return data?.display_name ?? fallbackDisplayName(email);
}

export async function renderHeader(container, pathname) {
  container.innerHTML = headerFragment;
  setActiveNavigationLink(container, pathname);

  const authLink = container.querySelector('[data-auth-link]');
  const authLinkItem = container.querySelector('[data-auth-link-item]');
  const greeting = container.querySelector('[data-header-greeting]');
  const greetingText = container.querySelector('[data-header-greeting-text]');
  const navItems = container.querySelectorAll('[data-nav-item]');
  const loggedInItem = container.querySelector('[data-logged-in-only]');
  const logoutButton = container.querySelector('[data-logout-button]');
  const adminLinkItem = container.querySelector('[data-admin-link-item]');

  try {
    const session = await getCurrentSession();

    if (session) {
      const [guideName, isAdmin] = await Promise.all([
        getSignedInGuideName(session),
        checkAdmin(),
      ]);

      navItems.forEach((item) => {
        if (item === adminLinkItem) {
          return;
        }
        item.classList.remove('d-none');
      });

      if (adminLinkItem) {
        adminLinkItem.classList.toggle('d-none', !isAdmin);
      }

      if (authLink) {
        authLink.setAttribute('href', '/');
        authLink.textContent = 'Home';
      }

      if (greeting && greetingText) {
        greetingText.textContent = `Hi, ${guideName}!`;
        greeting.hidden = false;
      }

      authLinkItem?.classList.remove('d-none');
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

  if (authLink) {
    authLink.textContent = 'Login / Register';
    authLink.setAttribute('href', '/login');
  }

  if (greeting) {
    greeting.hidden = true;
    if (greetingText) {
      greetingText.textContent = '';
    }
  }

  navItems.forEach((item) => item.classList.add('d-none'));
  authLink?.closest('li')?.classList.remove('d-none');
  loggedInItem?.classList.add('d-none');
}