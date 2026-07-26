import './home.css';

import homeFragment from './home.html?raw';

export async function renderHomePage(container) {
  container.innerHTML = homeFragment;
}