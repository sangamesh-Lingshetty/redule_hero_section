import './styles.css';
import { createScrollProgress } from './interaction/createScrollProgress';
import { createScene } from './scene/createScene';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App container was not found.');
}

const hero = document.createElement('main');
hero.className = 'hero-scroll';
hero.setAttribute('aria-label', 'Redule agentic operating system');

const viewport = document.createElement('section');
viewport.className = 'hero-viewport';
viewport.setAttribute('aria-label', 'Interactive Redule pipeline visualization');
hero.appendChild(viewport);
app.appendChild(hero);

const scene = createScene(viewport);
const scroll = createScrollProgress(hero, (progress) => {
  scene.setProgress(progress);
});

let disposed = false;
window.addEventListener(
  'pagehide',
  () => {
    if (disposed) return;
    disposed = true;
    scroll.dispose();
    scene.cleanup();
  },
  { once: true },
);
