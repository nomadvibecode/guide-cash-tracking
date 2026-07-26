import { loadFragment } from '../../utils/fragment-loader.js';

import './structure.css';

const structureFragmentUrl = new URL('./structure.html', import.meta.url);

export async function renderStructurePage(container) {
  container.innerHTML = await loadFragment(structureFragmentUrl);
}