import { notFound } from '@tanstack/react-router';

import { probeWriter } from './writer-status';

/** Let a surface that needs the write service open. When the service is offline, the surface
 * answers not-found, and its own not-found page speaks to the reader. */
export async function requireWriter(): Promise<void> {
  if (await probeWriter()) return;
  // `notFound({ throw: true })` is the documented alternative to `throw notFound()`: the value
  // the router raises is not an `Error`, and `only-throw-error` stays on.
  notFound({ throw: true });
}
