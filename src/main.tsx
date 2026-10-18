import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { probeWriter } from './shared/write/writer-status';
import './index.css';

const container = document.getElementById('root');
if (container === null) throw new Error('The element #root is absent from index.html.');

// The first read of the write service starts here, so the entries know it before they draw.
void probeWriter();

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
