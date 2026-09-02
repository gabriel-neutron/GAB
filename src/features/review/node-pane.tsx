import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

import { KindGlyph } from './change-mark';
import { Confidence } from './confidence';
import { ContestedGlyph } from './contested-mark';
import type { ChangeLine, Subject } from './queue';
import { VerdictMark } from './verdict-mark';
import { patchOpenRecord, readOpenRecord } from './workspace';

export interface NodePaneProps {
  readonly subject: Subject;
  readonly lines: readonly ChangeLine[];
  readonly currentChangeId: string | null;
  readonly onFocus: (changeId: string) => void;
}

const LINE = cn(
  'flex h-6 w-full items-center gap-1.5 border border-transparent border-l-2 px-1.5 text-left',
  'text-xs transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

const RECORD = 'record-as-it-stands';

export function NodePane({ subject, lines, currentChangeId, onFocus }: NodePaneProps) {
  const [openRecord, setOpenRecord] = useState(readOpenRecord);

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <h1 className="flex min-w-0 shrink-0 items-baseline gap-2">
        <span className="min-w-0 truncate text-base" title={subject.label}>
          {subject.label}
        </span>
        <span className="shrink-0 text-xs text-label">{subject.type}</span>
      </h1>

      <div className="shrink-0">
        {/* An icon-only control carries its name, and the count of what it opens with it. */}
        <button
          type="button"
          aria-expanded={openRecord}
          aria-controls={openRecord ? RECORD : undefined}
          aria-label={`The record as it stands, ${String(subject.standing.length)} values`}
          title={`The record as it stands, ${String(subject.standing.length)} values`}
          onClick={() => {
            setOpenRecord(!openRecord);
            patchOpenRecord(!openRecord);
          }}
          className={cn(LINE, 'w-6 justify-center border-l-transparent text-label')}
        >
          {openRecord ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </button>

        {openRecord ? (
          <dl id={RECORD} className="pl-4">
            {subject.standing.length === 0 ? (
              <p className="px-1.5 py-1 text-xs text-label">
                No value stands. Every value of this row arrives with the acts below.
              </p>
            ) : (
              subject.standing.map((row) => (
                <div
                  key={row.key}
                  data-standing={row.key}
                  className="flex h-6 items-center gap-2 px-1.5"
                >
                  <dt
                    className="w-32 min-w-0 shrink-0 truncate font-mono text-small/4 text-label"
                    title={row.key}
                  >
                    {row.key}
                  </dt>
                  <dd
                    className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums"
                    title={row.value}
                  >
                    {row.value}
                  </dd>
                  <dd className="shrink-0 font-mono text-small/4 text-label">{row.sources}</dd>
                </div>
              ))
            )}
          </dl>
        ) : null}
      </div>

      <ul
        aria-label="What is asked of this row"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {lines.map((line) => {
          const verdict = line.verdict;
          return (
            <li key={line.id}>
              <button
                type="button"
                data-line={line.id}
                data-contested={line.contested ? 'true' : undefined}
                aria-current={line.id === currentChangeId ? 'true' : undefined}
                onClick={() => {
                  onFocus(line.id);
                }}
                className={cn(
                  LINE,
                  // Every act that reads a contested key carries the same rule, so the pair
                  // reads as one bracket and not as two rows that happen to sit together.
                  line.contested ? 'border-l-dissent' : 'border-l-transparent',
                  line.id === currentChangeId ? 'bg-muted' : null,
                )}
              >
                <KindGlyph kind={line.kind} kindWords={line.kindWords} />
                <span className="min-w-0 flex-1 truncate font-mono" title={line.words}>
                  {line.words}
                </span>
                {line.contested ? (
                  <span title="Another act of this row reads a key that this one reads">
                    <ContestedGlyph />
                    <span className="sr-only">contested</span>
                  </span>
                ) : null}
                {verdict.state === 'waiting' ? (
                  <Confidence report={line.confidenceReport} low={false} />
                ) : (
                  <>
                    <VerdictMark verdict={verdict.verdict} words={verdict.words} />
                    {/* The line has no room for the word, so only a reader who hears it has it. */}
                    <span className="sr-only">{verdict.words}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
