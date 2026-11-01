import type { ReactNode } from 'react';
import { parseMarks, type Mark } from './marks';
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

type Run = Mark & { readonly before?: string; readonly after?: string };
const OPEN = /[([«“‘]+$/;
const CLOSE = /^[)\]»”’,.;:!?]+/;

/** Moves the opening punctuation before a node reference, and the closing punctuation after it,
 * into the run of the reference. */
function glue(marks: readonly Mark[]): Run[] {
  const runs: Run[] = [...marks];
  runs.forEach((run, index) => {
    if (run.kind !== 'node') return;
    const prev = runs[index - 1];
    const next = runs[index + 1];
    const before = prev?.kind === 'text' ? (OPEN.exec(prev.text)?.[0] ?? '') : '';
    const after = next?.kind === 'text' ? (CLOSE.exec(next.text)?.[0] ?? '') : '';
    if (prev?.kind === 'text' && before !== '')
      runs[index - 1] = { ...prev, text: prev.text.slice(0, -before.length) };
    if (next?.kind === 'text' && after !== '')
      runs[index + 1] = { ...next, text: next.text.slice(after.length) };
    runs[index] = { ...run, before, after };
  });
  return runs;
}

/** Report text with its marks drawn: node references, note markers, bold and italic. A note
 * marker never starts a line: it stays on the line of the word before it. */
export function RichText({ text, partSlug }: RichTextProps) {
  const runs = glue(parseMarks(text));
  const out: ReactNode[] = [];
  // The runs of one text never move, so their place is their identity.
  const draw = (run: Run, key: string): ReactNode => {
    if (run.kind === 'note')
      return partSlug === undefined ? (
        <sup key={key} className="font-mono text-report-label text-label">
          {run.id}
        </sup>
      ) : (
        <NoteRef key={key} partSlug={partSlug} id={run.id} />
      );
    if (run.kind === 'node')
      return (
        // The punctuation next to a reference stays on its line; the words of the reference wrap.
        <span key={key} className="whitespace-nowrap [&_button]:whitespace-normal">
          {run.before}
          {styled(run.bold, run.italic, <NodeRef id={run.id}>{run.text}</NodeRef>)}
          {run.after}
        </span>
      );
    return <span key={key}>{styled(run.bold, run.italic, run.text)}</span>;
  };
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index];
    if (run === undefined) continue;
    let end = index + 1;
    while (runs[end]?.kind === 'note') end++;
    if (run.kind !== 'text' || end === index + 1) {
      out.push(draw(run, `${run.kind}-${String(index)}`));
      continue;
    }
    // The last word of the text and its markers go in one box that does not break.
    const cut = run.text.search(/\S+$/);
    const head = cut < 0 ? run.text : run.text.slice(0, cut);
    const tail = cut < 0 ? '' : run.text.slice(cut);
    out.push(
      <span key={`text-${String(index)}`}>
        {head === '' ? null : styled(run.bold, run.italic, head)}
        <span className="whitespace-nowrap">
          {styled(run.bold, run.italic, tail)}
          {runs
            .slice(index + 1, end)
            .map((note, offset) => draw(note, `note-${String(index + 1 + offset)}`))}
        </span>
      </span>,
    );
    index = end - 1;
  }
  return <>{out}</>;
}
