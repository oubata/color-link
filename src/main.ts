import './styles/base.css';
import './styles/screens.css';
import { S } from './app/strings';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app not found');

// Phase 0 placeholder — replaced by the App bootstrap in phase 4.
const h1 = document.createElement('h1');
h1.textContent = S.appName;
h1.style.fontFamily = 'var(--font-serif)';
h1.style.fontSize = '32px';
h1.style.padding = '32px';
root.append(h1);
