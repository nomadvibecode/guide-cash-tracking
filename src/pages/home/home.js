import { loadFragment } from '../../utils/fragment-loader.js';

import './home.css';

const homeFragmentUrl = new URL('./home.html', import.meta.url);

export async function renderHomePage(container) {
  container.innerHTML = await loadFragment(homeFragmentUrl);
}