import { proposerWords } from '@/shared/proposer-words';

import { CitedImage } from './cited-image';
import { isImageType } from './document-image';
import { LinkedWords } from './linked-words';
import { pageAddress } from './page-address';
import type { Passage, SourceDocument, Unit } from './unit-page';

export interface JustificationProps {
  readonly unit: Unit | null;
}

const HEADING = 'text-small/4 tracking-caps text-label uppercase';

const LINK =
  'text-primary underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

// An entity and its relation can cite the same line, and one line is read once.
const distinct = (passages: readonly Passage[]): readonly Passage[] => {
  const held = new Map<string, Passage>();
  for (const passage of passages)
    held.set(`${passage.document} ${String(passage.page)} ${passage.text}`, passage);
  return [...held.values()];
};

/** Why the unit stands in the queue: who proposed it, the documents it cites with the exact words
 * of each page and two lines around them, the stored image of a cited PNG or JPEG, and the
 * dispute of each act. The operator compares the words that OCR read with the image, because OCR
 * can misread a character. */
export function Justification({ unit }: JustificationProps) {
  if (unit === null) return <section aria-label="The justification" className="p-3" />;
  const disputed = unit.acts.filter((act) => act.disputed);
  // The image of a document is read once, beside every passage that the unit cites from it.
  const passagesOf = (document: SourceDocument) =>
    distinct(unit.passages.filter((passage) => passage.document === document.id)).map((passage) => {
      const address = pageAddress(document, passage.page);
      return (
        <figure key={`${String(passage.page)} ${passage.text}`} data-passage>
          <figcaption className="text-small/4 text-label">
            {address === null ? (
              `Page ${String(passage.page)}`
            ) : (
              <a href={address} target="_blank" rel="noreferrer" className={LINK}>
                Open page {passage.page}
              </a>
            )}
          </figcaption>
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
        </figure>
      );
    });
  return (
    <section
      aria-label="The justification"
      className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-3 text-xs"
    >
      <div>
        <h3 className={HEADING}>Proposed by</h3>
        <p>{proposerWords(unit.proposer)}</p>
      </div>

      <div>
        <h3 className={HEADING}>Group</h3>
        <p>
          {unit.group === null ? 'No group' : (unit.group.subject ?? 'A group with no subject')}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className={HEADING}>Source</h3>
        {unit.documents.length === 0 ? <p>No document is cited.</p> : null}
        {unit.documents.map((document) => (
          <div key={document.id} data-document={document.id} className="space-y-1">
            <p className="break-words">
              {document.uri === null ? (
                document.title
              ) : (
                <a
                  href={document.uri}
                  title={document.uri}
                  target="_blank"
                  rel="noreferrer"
                  className={LINK}
                >
                  {document.title}
                </a>
              )}
            </p>
            {isImageType(document.mime) ? (
              <div className="flex items-start gap-2">
                <CitedImage document={document.id} title={document.title} />
                <div className="min-w-0 flex-1 space-y-1">{passagesOf(document)}</div>
              </div>
            ) : (
              passagesOf(document)
            )}
          </div>
        ))}
      </div>

      <div>
        <h3 className={HEADING}>Dispute</h3>
        {disputed.length === 0 ? (
          <p>No act of this unit is disputed.</p>
        ) : (
          <ul className="space-y-1">
            {disputed.map((act) => (
              <li key={act.id} className="text-dissent">
                {act.dispute ?? 'Disputed. The check recorded no reason.'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
