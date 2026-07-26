import { renderHeader } from '../components/header/header.js';
import { renderFooter } from '../components/footer/footer.js';
import { renderDashboardPage } from '../pages/dashboard/dashboard.js';
import { renderHomePage } from '../pages/home/home.js';
import { renderLoginPage } from '../pages/login/login.js';
import { renderNotFoundPage } from '../pages/not-found/not-found.js';
import { renderRunningBalancePage } from '../pages/running-balance/running-balance.js';
import { renderToursPage } from '../pages/tours/tours.js';

const routes = [
  {
    pattern: /^\/$/,
    title: 'Home',
    render: renderHomePage,
  },
  {
    pattern: /^\/login\/?$/,
    title: 'Login',
    render: renderLoginPage,
  },
  {
    pattern: /^\/dashboard\/?$/,
    title: 'Dashboard',
    render: renderDashboardPage,
  },
  {
    pattern: /^\/tours\/?$/,
    title: 'Tours',
    render: renderToursPage,
  },
  {
    pattern: /^\/running-balance\/([^/]+)\/?$/,
    title: ({ projectId }) => `Running Balance ${projectId}`,
    render: renderRunningBalancePage,
  },
];

function normalizePath(pathname) {
  return pathname !== '/' && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

function matchRoute(pathname) {
  const normalizedPath = normalizePath(pathname);

  for (const route of routes) {
    const match = normalizedPath.match(route.pattern);

    if (match) {
      const projectId = match[1] ? decodeURIComponent(match[1]) : undefined;

      return {
        route,
        params: {
          projectId,
        },
      };
    }
  }

  return null;
}

function setDocumentTitle(title) {
  document.title = title ? `Guide Cash Tracking | ${title}` : 'Guide Cash Tracking';
}

export function createRouter(shell) {
  async function renderCurrentRoute() {
    const pathname = window.location.pathname;
    const matchedRoute = matchRoute(pathname);

    await Promise.all([
      renderHeader(shell.header, pathname),
      renderFooter(shell.footer),
    ]);

    if (matchedRoute) {
      const { route, params } = matchedRoute;
      const title = typeof route.title === 'function' ? route.title(params) : route.title;

      setDocumentTitle(title);
      await route.render(shell.main, params);
      return;
    }

    setDocumentTitle('Page not found');
    await renderNotFoundPage(shell.main, { pathname });
  }

  function handleDocumentClick(event) {
    const link = event.target.closest('a[data-link="true"]');

    if (!link) {
      return;
    }

    const targetUrl = new URL(link.href, window.location.origin);

    if (targetUrl.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();

    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) {
      return;
    }

    window.history.pushState({}, '', targetUrl.pathname + targetUrl.search + targetUrl.hash);
    renderCurrentRoute();
  }

  window.addEventListener('popstate', renderCurrentRoute);
  document.addEventListener('click', handleDocumentClick);

  return {
    start() {
      renderCurrentRoute();
    },
  };
}