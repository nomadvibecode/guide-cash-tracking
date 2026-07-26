import { loadFragment } from '../../utils/fragment-loader.js';

import './tours.css';

const toursFragmentUrl = new URL('./tours.html', import.meta.url);

export async function renderToursPage(container) {
  container.innerHTML = await loadFragment(toursFragmentUrl);
}