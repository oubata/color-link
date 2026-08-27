import './styles/base.css';
import './styles/screens.css';
import { App } from './app/App';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app not found');

const app = new App({ root });
app.start();
