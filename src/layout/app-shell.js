export function mountShell() {
  const app = document.querySelector('#app');

  if (!app) {
    throw new Error('App root element was not found.');
  }

  app.innerHTML = `
    <div class="app-shell">
      <header id="site-header"></header>
      <main id="site-main" class="site-main"></main>
      <footer id="site-footer"></footer>
    </div>
  `;

  return {
    header: app.querySelector('#site-header'),
    main: app.querySelector('#site-main'),
    footer: app.querySelector('#site-footer'),
  };
}