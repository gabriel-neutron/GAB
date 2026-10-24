import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { loadCorpus } from './shared/read/corpus';
import { probeWriter } from './shared/write/writer-status';
import './index.css';

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

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
