import { loadFragment } from '../../utils/fragment-loader.js';

import './footer.css';

const footerFragmentUrl = new URL('./footer.html', import.meta.url);

export async function renderFooter(container) {
  container.innerHTML = await loadFragment(footerFragmentUrl);
}