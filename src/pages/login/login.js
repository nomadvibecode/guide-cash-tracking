import { loadFragment } from '../../utils/fragment-loader.js';
import { getCurrentSession, signInWithEmail, signUpWithEmail } from '../../services/auth.js';
import { ensureGuideWorkspace } from '../../services/guide-workspace.js';
import { hasSupabaseConfig } from '../../services/supabase-client.js';

import './login.css';

const loginFragmentUrl = new URL('./login.html', import.meta.url);

const authModeCopy = {
  login: {
    title: 'Sign in',
    copy: 'Use your account to access the dashboard and seeded reports.',
    submit: 'Login',
  },
  register: {
    title: 'Create account',
    copy: 'Create a guide account and start working with expense reports right away.',
    submit: 'Register',
  },
};

function renderConfigError(container) {
  container.innerHTML = `
    <section class="page-section">
      <div class="container">
        <div class="row justify-content-center py-4 py-md-5">
          <div class="col-12 col-md-10 col-lg-7 col-xl-6">
            <div class="page-panel login-card p-4 p-md-5 text-center">
              <p class="page-kicker mb-2">Authentication</p>
              <h1 class="h3 fw-bold mb-3">Supabase config missing</h1>
              <p class="text-secondary mb-0">Set the Vite Supabase environment variables before using login or register.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function setAuthMode(container, mode) {
  const title = container.querySelector('[data-auth-title]');
  const copy = container.querySelector('[data-auth-copy]');
  const submit = container.querySelector('[data-auth-submit]');
  const registerFields = container.querySelector('[data-register-fields]');
  const switchButtons = container.querySelectorAll('[data-auth-switch]');

  const nextMode = mode === 'register' ? 'register' : 'login';
  const modeCopy = authModeCopy[nextMode];

  title.textContent = modeCopy.title;
  copy.textContent = modeCopy.copy;
  submit.textContent = modeCopy.submit;
  registerFields.hidden = nextMode !== 'register';

  switchButtons.forEach((button) => {
    const isActive = button.dataset.authSwitch === nextMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  container.dataset.authMode = nextMode;
}

export async function renderLoginPage(container) {
  if (!hasSupabaseConfig) {
    renderConfigError(container);
    return;
  }

  try {
    const session = await getCurrentSession();

    if (session) {
      window.location.replace('/dashboard');
      return;
    }
  } catch {
    // Continue rendering the form if the session cannot be read.
  }

  container.innerHTML = await loadFragment(loginFragmentUrl);

  const form = container.querySelector('[data-auth-form]');
  const status = container.querySelector('[data-auth-status]');
  const submit = container.querySelector('[data-auth-submit]');
  const emailInput = container.querySelector('#authEmail');
  const passwordInput = container.querySelector('#authPassword');
  const confirmPasswordInput = container.querySelector('#authConfirmPassword');
  const switchButtons = container.querySelectorAll('[data-auth-switch]');

  let currentMode = 'login';

  setAuthMode(container, currentMode);

  switchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentMode = button.dataset.authSwitch === 'register' ? 'register' : 'login';
      setAuthMode(container, currentMode);
      status.textContent = '';
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (currentMode === 'register' && password !== confirmPassword) {
      status.textContent = 'Passwords do not match.';
      return;
    }

    submit.disabled = true;
    status.textContent = currentMode === 'register' ? 'Creating your account...' : 'Signing you in...';

    try {
      if (currentMode === 'register') {
        const { data, error } = await signUpWithEmail(email, password);

        if (error) {
          throw error;
        }

        const activeSession = data.session ?? (await getCurrentSession());

        if (activeSession?.user) {
          await ensureGuideWorkspace(activeSession.user);
          window.location.replace('/dashboard');
          return;
        }

        const signInResult = await signInWithEmail(email, password);

        if (signInResult.error) {
          throw signInResult.error;
        }

        const signedInSession = signInResult.data?.session ?? (await getCurrentSession());

        if (signedInSession?.user) {
          await ensureGuideWorkspace(signedInSession.user);
        }

        window.location.replace('/dashboard');
        return;
      }

      const { data, error } = await signInWithEmail(email, password);

      if (error) {
        throw error;
      }

      const session = data.session ?? (await getCurrentSession());

      if (session?.user) {
        await ensureGuideWorkspace(session.user);
      }

      window.location.replace('/dashboard');
    } catch (error) {
      status.textContent = error?.message ?? 'Authentication failed.';
    } finally {
      submit.disabled = false;
    }
  });
}