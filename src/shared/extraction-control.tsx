import { useState } from 'react';

import { extract, extractionScreen, readStatus, type ExtractionView } from './extraction';
import { SaidLine } from './said-line';
import { Button } from './ui/button';

export interface ExtractionControlProps {
  /** A stored document. The writer refuses one with no bytes, and says so. */
  readonly documentId: string;
}

const UNREAD: ExtractionView = { step: 'unread' };

const SAYS = 'The extraction of the claims';

export function ExtractionControl({ documentId }: ExtractionControlProps) {
  const [view, setView] = useState<ExtractionView>(UNREAD);
  const screen = extractionScreen(view);
  const working = view.step === 'working';

  // A second click while one request is in flight queues nothing twice: the step guards as well
  // as the button, and the record refuses a second open job.
  const run = (work: (id: string) => Promise<ExtractionView>): void => {
    if (working) return;
    setView({ step: 'working' });
    void work(documentId).then(setView);
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
