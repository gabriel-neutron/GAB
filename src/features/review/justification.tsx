import { cn } from '@/shared/lib/utils';
import { proposerWords } from '@/shared/proposer-words';

import { checkLines } from './check-words';
import { CitedImage } from './cited-image';
import { isImageType } from './document-image';
import { documentName } from './document-name';
import { withFullStop } from './full-stop';
import { LinkedWords } from './linked-words';
import { pageAddress } from './page-address';
import type { Fault, FaultLevel, Passage, SourceDocument, Unit } from './unit-page';

export interface JustificationProps {
  readonly unit: Unit | null;
}

const BADGE = 'border border-border px-1 text-small/4';

const STATE_WORDS: Readonly<Record<Unit['state'], string>> = {
  clean: 'Clean',
  not_clean: 'Not clean',
  blocked: 'Blocked',
};

const HEADING = 'text-small/4 tracking-caps text-label uppercase';

// A wait for a unit of the same group is not listed: a group action writes the unit, and the
// decision bar says why Promote of the unit alone is off.
const LEVELS: readonly {
  readonly level: Exclude<FaultLevel, 'waits'>;
  readonly words: string;
  readonly paint: string;
}[] = [
  { level: 'blocks', words: 'Blocks Promote', paint: 'text-destructive' },
  { level: 'not_clean', words: 'Not clean: decide it alone', paint: 'text-dissent' },
  { level: 'information', words: 'Information', paint: 'text-foreground' },
];

const LINK =
  'text-primary underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

// An entity and its relation can cite the same line. One line is read once, and it names each
// element that it supports.
const distinct = (passages: readonly Passage[]): readonly Passage[] => {
  const held = new Map<string, Passage>();
  for (const passage of passages) {
    const key = `${passage.document} ${String(passage.page)} ${passage.text}`;
    const before = held.get(key);
    held.set(
      key,
      before === undefined || before.supports === passage.supports
        ? passage
        : { ...before, supports: `${before.supports}; ${passage.supports}` },
    );
  }
  return [...held.values()];
};

// A fault that states the reason of a doubt is in the list of faults. Do not say it twice.
const saysMore = (unit: Unit): boolean =>
  unit.said !== '' &&
  (unit.lane === 'waiting' || !unit.faults.some((fault) => unit.said.includes(fault.said)));

const listed = (faults: readonly Fault[]): readonly Fault[] =>
  faults.filter((fault) => fault.level !== 'waits');

/** The words of a passage. The own line of a unit comes first, and the lines of the
 * other units around it are folded. */
function Quote({ passage }: { readonly passage: Passage }) {
  if (passage.transcribed)
    return (
      <div className="space-y-1" data-transcribed>
        <p className="text-small/4 text-label">
          Read from the image by the AI, not by OCR. Compare each word with the image.
        </p>
        <blockquote className="border-l border-border pl-2 break-words whitespace-pre-line">
          <mark className="bg-muted text-foreground">
            <LinkedWords text={passage.text} />
          </mark>
        </blockquote>
      </div>
    );
  if (passage.ownLine)
    return (
      <details className="text-label">
        <summary className="cursor-default">The source line of this unit</summary>
        <div className="mt-1 space-y-1">
          <blockquote className="border-l border-border pl-2 break-words whitespace-pre-line">
            <mark className="bg-muted text-foreground">
              <LinkedWords text={passage.text} />
            </mark>
          </blockquote>
          {passage.before.trim() === '' && passage.after.trim() === '' ? null : (
            <details>
              <summary className="cursor-default">The lines of other units around it</summary>
              <blockquote className="border-l border-border pl-2 break-words whitespace-pre-line">
                <LinkedWords text={passage.before} />
                <span className="text-foreground">[this line]</span>
                <LinkedWords text={passage.after} />
              </blockquote>
            </details>
          )}
        </div>
      </details>
    );
  return (
    <blockquote className="border-l border-border pl-2 break-words whitespace-pre-line">
      <span className="text-label">
        <LinkedWords text={passage.before} />
      </span>
      <mark className="bg-muted text-foreground">
        <LinkedWords text={passage.text} />
      </mark>
      <span className="text-label">
        <LinkedWords text={passage.after} />
      </span>
    </blockquote>
  );
}

/** Why the unit stands in the queue: who proposed it, which check ran on each act, the documents it
 * cites with the exact words of each page and two lines around them, the stored image of a cited
 * PNG or JPEG, and each fault that the check found, with its sentence. The operator compares the
 * words that OCR or the AI read with the image, because each one can misread a character. */
export function Justification({ unit }: JustificationProps) {
  if (unit === null) return <section aria-label="The justification" className="p-3" />;
  const checks = checkLines(unit.acts);
  // The image of a document is read once, beside every passage that the unit cites from it.
  const passagesOf = (document: SourceDocument) =>
    distinct(unit.passages.filter((passage) => passage.document === document.id)).map((passage) => {
      const address = pageAddress(document, passage.page);
      return (
        <figure
          key={`${String(passage.page)} ${passage.text}`}
          data-passage
          data-own-line={passage.ownLine ? 'true' : undefined}
        >
          <figcaption className="text-small/4 text-label">
            <span data-supports>
              {'Evidence for '}
              <span className="text-foreground">{passage.supports}</span>
            </span>
            {' · '}
            {address === null ? (
              `page ${String(passage.page)}`
            ) : (
              <a href={address} target="_blank" rel="noreferrer" className={LINK}>
                Open page {passage.page}
              </a>
            )}
          </figcaption>
          <Quote passage={passage} />
        </figure>
      );
    });
  return (
    <section
      aria-label="The justification"
      className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-3 text-xs"
    >
      <div className="flex flex-wrap items-center gap-1" data-strip>
        <span
          data-badge="state"
          className={cn(BADGE, unit.state === 'blocked' && 'text-destructive')}
          data-state={unit.state}
        >
          {STATE_WORDS[unit.state]}
        </span>
        <span data-badge="proposer" className={BADGE}>
          {proposerWords(unit.proposer)}
        </span>
        <span
          data-badge="group"
          title={unit.group?.subject ?? undefined}
          className={cn(BADGE, 'min-w-0 truncate')}
        >
          {unit.group === null ? 'No group' : (unit.group.subject ?? 'A group with no subject')}
        </span>
      </div>

      {!saysMore(unit) ? null : (
        <div className="space-y-0.5" data-lane={unit.lane}>
          <h3 className={HEADING}>
            {unit.lane === 'doubt' ? 'Why it is a doubt' : 'What it needs'}
          </h3>
          <p className="break-words">{withFullStop(unit.said)}</p>
        </div>
      )}

      <div className="space-y-0.5">
        <h3 className={HEADING}>Check</h3>
        <ul className="space-y-0.5">
          {checks.map((line) => (
            <li
              key={line.act}
              data-check={line.state}
              className={cn('break-words', line.state === 'disputed' && 'text-dissent')}
            >
              {checks.length > 1 ? `${line.name}: ` : ''}
              {withFullStop(line.words)}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2" data-faults={unit.state}>
        <h3 className={HEADING}>Faults</h3>
        {listed(unit.faults).length === 0 ? <p>No fault.</p> : null}
        {LEVELS.map(({ level, words, paint }) => {
          const held = unit.faults.filter((fault) => fault.level === level);
          if (held.length === 0) return null;
          return (
            <div key={level}>
              <h4 className={cn('text-small/4', paint)}>{words}</h4>
              <ul className="space-y-0.5">
                {held.map((fault) => (
                  <li
                    key={`${fault.kind} ${fault.said}`}
                    data-fault={fault.kind}
                    className="break-words"
                  >
                    {withFullStop(fault.said)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h3 className={HEADING}>Source</h3>
        {unit.documents.length === 0 ? <p>No document is cited.</p> : null}
        {unit.documents.map((document) => (
          <div
            key={document.id}
            data-document={document.id}
            className="space-y-1 border border-border p-2"
          >
            <p className="font-medium break-words">
              {document.uri === null ? (
                documentName(document)
              ) : (
                <a
                  href={document.uri}
                  title={document.uri}
                  target="_blank"
                  rel="noreferrer"
                  className={LINK}
                >
                  {documentName(document)}
                </a>
              )}
            </p>
            {isImageType(document.mime) ? (
              <div className="flex items-start gap-2">
                <CitedImage document={document.id} title={documentName(document)} />
                <div className="min-w-0 flex-1 space-y-1">{passagesOf(document)}</div>
              </div>
            ) : (
              passagesOf(document)
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
