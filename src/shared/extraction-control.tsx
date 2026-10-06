import { useEffect, useState } from 'react';

import {
  extract,
  extractionScreen,
  readStatus,
  stillOpen,
  type ExtractionState,
} from './extraction';
import { SaidLine } from './said-line';
import { Button } from './ui/button';

export interface ExtractionControlProps {
  /** A stored document. The writer refuses one with no bytes, and says so. */
  readonly documentId: string;
}

const UNREAD: ExtractionState = { step: 'idle' };

const SAYS = 'The extraction of the claims';

// Origin: decided, not calibrated. A chunk of a document takes the model some seconds, so a
// shorter wait reads the same status again.
const REFRESH_MS = 4000;

export function ExtractionControl({ documentId }: ExtractionControlProps) {
  const [state, setState] = useState<ExtractionState>(UNREAD);
  const screen = extractionScreen(state);
  const working = state.step === 'working';

  // A job that waits or runs reads its status again by itself. A new state, a click or the close
  // of the control stops the wait, and an answer that arrives after it changes nothing.
  useEffect(() => {
    if (!stillOpen(state)) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      void readStatus(documentId).then((next) => {
        if (live) setState(next);
      });
    }, REFRESH_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [state, documentId]);

  // A second click while one request is in flight queues nothing twice: the step guards as well
  // as the button, and the record refuses a second open job.
  const run = (work: (id: string) => Promise<ExtractionState>): void => {
    if (working) return;
    setState({ step: 'working' });
    void work(documentId).then(setState);
  };

  return (
    <div className="space-y-1">
      <SaidLine said={screen.said} label={SAYS} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="xs"
          disabled={!screen.canExtract}
          onClick={() => {
            run(extract);
          }}
        >
          {screen.action}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={working}
          onClick={() => {
            run(readStatus);
          }}
        >
          Read the status
        </Button>
      </div>
    </div>
  );
}
