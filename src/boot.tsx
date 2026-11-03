// The start of the application: the reads, the router and the render. `main.tsx` loads it.
import { StrictMode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { loadCorpus } from './shared/read/corpus';
import { probeWriter } from './shared/write/writer-status';

const container = document.getElementById('root');
if (container === null) throw new Error('The element #root is absent from index.html.');

// The first read of the write service starts here, so the entries know it before they draw.
void probeWriter();

// The first read of the record starts here too. A read that finds the service down loads the
// release, which sets the release note on a page that reads no record. A fault shows on the page that
// needs the record, so it is not shown twice.
loadCorpus().catch(() => undefined);

// A page of the release holds its text in the root already. The first render waits for the data of
// the route, so the text is replaced by the same text and never by a loading notice.
if (container.hasChildNodes()) await router.load().catch(() => undefined);

// React DOM loads apart, so its code runs in a task of its own and the start is not one long task.
const { createRoot, hydrateRoot } = await import('react-dom/client');

const app = (
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
// External constraint: the router adds a boundary at the top on the client and not on the server,
// unless `router.ssr` is set. Without it, the hydration fails (React error 418) and the client
// draws the whole page again. The release render gives no manifest of assets.
if (container.hasChildNodes()) {
  router.ssr = { manifest: undefined };
  hydrateRoot(container, app);
} else createRoot(container).render(app);
