import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import './styles/global.css';

import { mountShell } from './layout/app-shell.js';
import { createRouter } from './router/router.js';

const shell = mountShell();
const router = createRouter(shell);

router.start();