import { CircleDashed } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { ConfidenceReport } from './queue';

export interface ConfidenceProps {
  readonly report: ConfidenceReport;
  /** The self-report is under the threshold in force. It marks a figure, and never an absence. */
  readonly low: boolean;
}

/** The self-report of the machine. It is a track and a figure, and never the word "confidence":
 * the rating of the document outranks it, so it must not be the loudest thing on a card. */
export function Confidence({ report, low }: ConfidenceProps) {
  if (!report.stated) {
    return (
      <span
        data-confidence="absent"
        title={report.words}
        className="inline-flex shrink-0 items-center text-label"
      >
        <CircleDashed size={14} aria-hidden="true" />
        <span className="sr-only">{report.words}</span>
      </span>
    );
  }

  return (
    <span
      data-confidence={report.figure}
      title={report.words}
      className="inline-flex shrink-0 items-center gap-1"
    >
      <span aria-hidden="true" className="block h-1 w-6 bg-muted">
        {/* The width is the value itself, so it cannot be a class. */}
        <span
          style={{ width: `${String(report.fill)}%` }}
          className={cn('block h-1', low ? 'bg-dissent' : 'bg-label')}
        />
      </span>
      <span
        className={cn('font-mono text-small/4 tabular-nums', low ? 'text-dissent' : 'text-label')}
      >
        {report.figure}
      </span>
      <span className="sr-only">{report.words}</span>
    </span>
  );
}
