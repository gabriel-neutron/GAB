import type { ReactNode } from 'react';

import { useWriterOnline } from './writer-status';

interface WhenWriterOnlineProps {
  readonly children: ReactNode;
}

/** Draw the entries that need the write service, and nothing while it is offline or unknown. */
export function WhenWriterOnline({ children }: WhenWriterOnlineProps) {
  return useWriterOnline() ? children : null;
}
