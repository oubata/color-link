import './styles/base.css';
import './styles/screens.css';
import { App } from './app/App';
import { createFeedback } from './app/feedback';
import { Haptics } from './audio/haptics';
import { Sfx } from './audio/sfx';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app not found');

const app = new App({ root });
app.setFeedback(
  createFeedback(new Sfx(), new Haptics(), () => app.currentSettings),
);
app.start();
