import { loadFragment } from '../../utils/fragment-loader.js';

import './login.css';

const loginFragmentUrl = new URL('./login.html', import.meta.url);

export async function renderLoginPage(container) {
  container.innerHTML = await loadFragment(loginFragmentUrl);

  const form = container.querySelector('[data-login-form]');
  const status = container.querySelector('[data-login-status]');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (status) {
      status.textContent = 'Login form scaffold ready for future authentication wiring.';
    }
  });
}