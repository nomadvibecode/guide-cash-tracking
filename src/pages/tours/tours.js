import { getCurrentSession } from '../../services/auth.js';
import { hasSupabaseConfig } from '../../services/supabase-client.js';
import { createTourForGuide, joinTour, loadToursPageData } from '../../services/tours.js';

import './tours.css';

const currencyFormatterCache = new Map();

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function displayNameFromEmail(email) {
  const localPart = (email ?? 'guide').split('@')[0];

  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStatus(status) {
  return status.replaceAll('_', ' ');
}

function statusClass(status) {
  if (status === 'finished') {
    return 'bg-success-subtle text-success border-success-subtle';
  }

  if (status === 'in_progress') {
    return 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
  }

  return 'bg-secondary-subtle text-secondary border-secondary-subtle';
}

function formatCount(value, label) {
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

function splitToursByStatus(tours) {
  return tours.reduce(
    (groups, tour) => {
      groups[tour.status] ??= [];
      groups[tour.status].push(tour);
      return groups;
    },
    {
      not_started: [],
      in_progress: [],
      finished: [],
    },
  );
}

function renderLoadingState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
          <p class="mt-3 mb-0 text-secondary">Loading tours from Supabase...</p>
        </div>
      </div>
    </section>
  `;
}

function renderConfigError() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Supabase</p>
          <h1 class="h3 mb-3">Missing frontend environment variables</h1>
          <p class="mb-0 text-secondary">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> before opening the tours page.</p>
        </div>
      </div>
    </section>
  `;
}

function renderSignedOutState() {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Tours</p>
          <h1 class="h3 mb-3">Sign in to join or create tours</h1>
          <p class="mb-0 text-secondary">Use your guide account to pick a tour from the list or add a new one for your team.</p>
        </div>
      </div>
    </section>
  `;
}

function renderErrorState(message) {
  return `
    <section class="page-section">
      <div class="container">
        <div class="page-panel p-4 p-lg-5 text-center">
          <p class="page-kicker mb-2">Tours</p>
          <h1 class="h3 mb-3">Could not load tours</h1>
          <p class="mb-0 text-secondary">${message}</p>
        </div>
      </div>
    </section>
  `;
}

function renderGuideChip(assignment, currentGuideId, ownerGuideId) {
  const guide = assignment.guide_profiles;
  const isCurrentGuide = assignment.guide_id === currentGuideId;
  const isOwner = assignment.guide_id === ownerGuideId;
  const label = guide?.display_name ?? displayNameFromEmail(guide?.email);

  return `
    <span class="tour-guide-chip ${isOwner ? 'is-owner' : ''} ${isCurrentGuide ? 'border border-primary' : ''}">
      ${label}${isOwner ? ' · owner' : ''}${isCurrentGuide ? ' · you' : ''}
    </span>
  `;
}

function renderTourCard(tour, currentGuideId) {
  const guideAssignments = [...(tour.tour_guides ?? [])].sort((left, right) => {
    if (left.guide_id === tour.tour_guide_id) {
      return -1;
    }

    if (right.guide_id === tour.tour_guide_id) {
      return 1;
    }

    return 0;
  });

  const guideCount = guideAssignments.length;
  const isAssigned = guideAssignments.some((assignment) => assignment.guide_id === currentGuideId);
  const isFull = guideCount >= 3;
  const actions = [];

  if (isAssigned) {
    actions.push('<span class="badge rounded-pill border bg-primary-subtle text-primary border-primary-subtle">You are on this tour</span>');
  } else if (isFull) {
    actions.push('<span class="badge rounded-pill border bg-secondary-subtle text-secondary border-secondary-subtle">Tour full</span>');
  } else {
    actions.push(`<button class="btn btn-primary" type="button" data-join-tour data-tour-id="${tour.id}">Join tour</button>`);
  }

  return `
    <article class="tour-card">
      <div class="tour-card-header">
        <div>
          <h3 class="tour-card-title">${tour.tour_name}</h3>
          <div class="tour-card-meta mt-2">${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}</div>
        </div>
        <span class="badge rounded-pill border ${statusClass(tour.status)}">${formatStatus(tour.status)}</span>
      </div>

      <div class="d-flex flex-wrap gap-2 mt-3">
        <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${formatCount(tour.tour_days ?? Math.max(1, Math.ceil((new Date(tour.end_date) - new Date(tour.start_date)) / 86400000) + 1), 'day')}</span>
        <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${formatCount(guideCount, 'guide')} assigned</span>
        <span class="badge rounded-pill border bg-light text-dark border-light-subtle">${tour.guest_count} guests</span>
      </div>

      <div class="tour-guides">
        ${guideAssignments.map((assignment) => renderGuideChip(assignment, currentGuideId, tour.tour_guide_id)).join('')}
      </div>

      <div class="d-flex flex-wrap gap-2 mt-4">
        ${actions.join('')}
      </div>
    </article>
  `;
}

function renderCreateTourForm(defaultDate) {
  return `
    <section class="page-panel tours-form-card p-4 p-lg-5">
      <div class="tour-form-intro">
        <p class="page-kicker mb-2">Create tour</p>
        <h2 class="h4 mb-3">Add your own tour</h2>
        <p class="text-secondary mb-0">Start a new tour with you as the first guide, then let up to two more guides join.</p>
      </div>

      <form class="tour-form-body" data-create-tour-form>
        <div class="tour-form-row">
          <label class="form-label" for="tourName">Tour name</label>
          <input class="form-control form-control-lg" id="tourName" name="tourName" type="text" maxlength="120" placeholder="Balkan Highlights 2026" required />
        </div>

        <div class="tour-form-row">
          <label class="form-label" for="tourStartDate">Start date</label>
          <input class="form-control form-control-lg" id="tourStartDate" name="startDate" type="date" value="${defaultDate}" required />
        </div>

        <div class="tour-form-row">
          <label class="form-label" for="tourEndDate">End date</label>
          <input class="form-control form-control-lg" id="tourEndDate" name="endDate" type="date" value="${defaultDate}" required />
        </div>

        <div class="tour-form-grid-two">
          <div class="tour-form-row">
            <label class="form-label" for="tourGuestCount">Guests</label>
            <input class="form-control form-control-lg" id="tourGuestCount" name="guestCount" type="number" min="0" step="1" value="0" required />
          </div>

          <div class="tour-form-row">
            <label class="form-label" for="tourStatus">Status</label>
            <select class="form-select form-select-lg" id="tourStatus" name="status">
              <option value="not_started">Not started</option>
              <option value="in_progress" selected>In progress</option>
              <option value="finished">Finished</option>
            </select>
          </div>
        </div>

        <div class="tour-form-actions">
          <button class="btn btn-primary btn-lg py-3" type="submit">Create tour</button>
        </div>
      </form>
      <p class="small text-secondary mt-3 mb-0" data-create-tour-status></p>
    </section>
  `;
}

function renderStatusColumn(title, description, status, tours, currentGuideId) {
  return `
    <section class="tour-status-column">
      <div class="tour-status-column-header">
        <div>
          <p class="page-kicker mb-2">${title}</p>
          <h2 class="h5 mb-1">${description}</h2>
        </div>
        <span class="tour-status-count">${tours.length}</span>
      </div>
      <div class="tour-status-list">
        ${tours.map((tour) => renderTourCard(tour, currentGuideId)).join('') || '<div class="tour-status-empty text-secondary">No tours in this status.</div>'}
      </div>
    </section>
  `;
}

function getTourDays(tour) {
  const start = new Date(tour.start_date);
  const end = new Date(tour.end_date);
  const diff = Math.round((end - start) / 86400000) + 1;

  return Number.isFinite(diff) && diff > 0 ? diff : 1;
}

export async function renderToursPage(container) {
  container.innerHTML = renderLoadingState();

  if (!hasSupabaseConfig) {
    container.innerHTML = renderConfigError();
    return;
  }

  try {
    const session = await getCurrentSession();

    if (!session?.user) {
      container.innerHTML = renderSignedOutState();
      return;
    }

    const allTours = await loadToursPageData();
    const tours = allTours.filter((tour) => (tour.tour_guides ?? []).some((assignment) => assignment.guide_id === session.user.id));
    const toursWithDays = tours.map((tour) => ({
      ...tour,
      tour_days: getTourDays(tour),
    }));
    const groupedTours = splitToursByStatus(toursWithDays);
    const defaultDate = new Date().toISOString().slice(0, 10);
    const totalTours = toursWithDays.length;
    const availableTours = toursWithDays.filter((tour) => (tour.tour_guides ?? []).length < 3).length;

    container.innerHTML = `
      <section class="page-section">
        <div class="container">
          <div class="tours-shell">
            <section class="page-panel tours-hero p-4 p-lg-5">
              <div>
                <p class="page-kicker mb-2">Tours</p>
                <h1 class="display-6 fw-bold mb-3">Pick a tour or create one for your crew</h1>
                <p class="lead text-secondary mb-0">${displayNameFromEmail(session.user.email)} can see every tour they created or joined, grouped by status.</p>
              </div>
              <div class="tours-hero-stats">
                <div class="tour-stat">
                  <div class="tour-stat-value">${totalTours}</div>
                  <div class="tour-stat-label">Total tours</div>
                </div>
                <div class="tour-stat">
                  <div class="tour-stat-value">${availableTours}</div>
                  <div class="tour-stat-label">Open tours</div>
                </div>
              </div>
            </section>

            <section class="tour-full-width-panel">
              ${renderCreateTourForm(defaultDate)}
            </section>

            <section class="page-panel tours-list-panel p-4 p-lg-5">
              <div class="d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-3 mb-4">
                <div>
                  <p class="page-kicker mb-2">Assigned tours</p>
                  <h2 class="h4 mb-0">Tours you created or joined</h2>
                </div>
                <p class="text-secondary mb-0">${totalTours} tours loaded</p>
              </div>

              <div class="tour-status-board">
                ${renderStatusColumn('Not started', 'not started', 'not_started', groupedTours.not_started, session.user.id)}
                ${renderStatusColumn('In progress', 'in progress', 'in_progress', groupedTours.in_progress, session.user.id)}
                ${renderStatusColumn('Finished', 'finished', 'finished', groupedTours.finished, session.user.id)}
              </div>
              <div class="d-none" data-tours-list>
                ${toursWithDays.map((tour) => renderTourCard(tour, session.user.id)).join('')}
              </div>
            </section>
          </div>
        </div>
      </section>
    `;

    const createTourForm = container.querySelector('[data-create-tour-form]');
    const createTourStatus = container.querySelector('[data-create-tour-status]');
    const joinButtons = container.querySelectorAll('[data-join-tour]');

    createTourForm?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const tourName = createTourForm.tourName.value.trim();
      const startDate = createTourForm.startDate.value;
      const endDate = createTourForm.endDate.value;
      const status = createTourForm.status.value;
      const guestCount = Number(createTourForm.guestCount.value);

      if (!tourName || !startDate || !endDate || !Number.isFinite(guestCount) || guestCount < 0) {
        createTourStatus.textContent = 'Fill in a valid tour name, dates, and guest count.';
        return;
      }

      if (endDate < startDate) {
        createTourStatus.textContent = 'The end date cannot be earlier than the start date.';
        return;
      }

      const submitButton = createTourForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      createTourStatus.textContent = 'Creating tour...';

      try {
        await createTourForGuide({
          user: session.user,
          tourName,
          startDate,
          endDate,
          status,
          guestCount,
        });

        await renderToursPage(container);
      } catch (error) {
        createTourStatus.textContent = error?.message ?? 'Could not create the tour.';
        submitButton.disabled = false;
      }
    });

    joinButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const tourId = button.dataset.tourId;

        button.disabled = true;

        try {
          const result = await joinTour({ tourId, guideId: session.user.id });

          if (!result.joined) {
            button.disabled = false;
            button.textContent = result.reason === 'tour_full' ? 'Tour full' : 'You are on this tour';
            return;
          }

          await renderToursPage(container);
        } catch (error) {
          button.disabled = false;
          button.textContent = error?.message ?? 'Could not join tour.';
        }
      });
    });
  } catch (error) {
    container.innerHTML = renderErrorState(error?.message ?? 'Unknown Supabase error.');
  }
}