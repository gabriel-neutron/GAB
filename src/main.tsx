import './index.css';

// A page of the release holds its text in the root already, so the browser loads and paints it
// with its images first, and only then loads the script of the application. The script never
// delays the first paint of the text or of the cover. An empty root (the dev server, a page with
// no text) starts the application at once.
const prerendered = document.getElementById('root')?.hasChildNodes() === true;
const boot = () => import('./boot');

const loaded = new Promise<void>((resolve) => {
  if (document.readyState === 'complete') resolve();
  else addEventListener('load', () => resolve(), { once: true });
});

const PAINT_WAIT_MS = 3000;
const painted = new Promise<void>((resolve) => {
  // A browser with no paint timing, or a page in a hidden tab, starts after the wait.
  setTimeout(resolve, PAINT_WAIT_MS);
  try {
    new PerformanceObserver((list) => {
      if (list.getEntriesByName('first-contentful-paint').length > 0) resolve();
    }).observe({ type: 'paint', buffered: true });
  } catch {
    resolve();
  }
});

if (prerendered)
  void Promise.all([loaded, painted]).then(() => {
    setTimeout(() => void boot());
  });
else void boot();
