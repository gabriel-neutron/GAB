import type { ReactNode } from 'react';
import { parseMarks } from './marks';
import { NodeRef } from './node-ref';
import { NoteRef } from './note-ref';

interface RichTextProps {
  readonly text: string;
  /** The part that holds the notes of the text. Without it, a note marker shows its bare id. */
  readonly partSlug?: string | undefined;
}

const styled = (bold: boolean, italic: boolean, content: ReactNode): ReactNode => {
  const slanted = italic ? <em>{content}</em> : content;
  // Weight 500 is the one strong weight of the type scale.
  return bold ? <strong className="font-medium">{slanted}</strong> : slanted;
};

/** Report text with its marks drawn: node references, note markers, bold and italic. */
export function RichText({ text, partSlug }: RichTextProps) {
  return (
    <>
      {parseMarks(text).map((run, index) => {
        // The runs of one text never move, so their place is their identity.
        const key = `${run.kind}-${index}`;
        if (run.kind === 'note')
          return partSlug === undefined ? (
            <sup key={key} className="font-mono text-small text-label">
              {run.id}
            </sup>
          ) : (
            <NoteRef key={key} partSlug={partSlug} id={run.id} />
          );
        if (run.kind === 'node')
          return (
            <span key={key}>
              {styled(run.bold, run.italic, <NodeRef id={run.id}>{run.text}</NodeRef>)}
            </span>
          );
        return <span key={key}>{styled(run.bold, run.italic, run.text)}</span>;
      })}
    </>
  );
}
