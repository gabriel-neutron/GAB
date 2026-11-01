import type { ReactNode } from 'react';
import type { ReportBlock } from './content';
import { FigureFrame } from './figure-frame';
import { RichText } from './rich-text';
import { useContent } from './use-content';

interface BlocksProps {
  readonly blocks: readonly ReportBlock[];
  readonly partSlug: string;
}

/** The body of a part: paragraphs, subheads, lists and figure frames, in the order of the text.
 * A figure shows its frame and a placeholder until a part draws its chart. */
export function Blocks({ blocks, partSlug }: BlocksProps) {
  const { figureTexts, ui } = useContent();
  const figureNotes: Readonly<Partial<Record<string, { readonly note: string }>>> =
    figureTexts.figures;
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const closeList = (key: string) => {
    if (list.length === 0) return;
    out.push(
      <ul
        key={`list-${key}`}
        className="my-4 max-w-[64ch] list-disc space-y-2 pl-5 marker:text-label"
      >
        {list}
      </ul>,
    );
    list = [];
  };
  blocks.forEach((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${partSlug}-${index}`;
    const text = <RichText text={block.text} partSlug={partSlug} />;
    if (block.kind === 'li') {
      list.push(<li key={key}>{text}</li>);
      return;
    }
    closeList(key);
    if (block.kind === 'h3')
      out.push(
        <h3 key={key} className="mt-10 mb-3 max-w-[40ch] text-report-lead text-balance">
          {text}
        </h3>,
      );
    else if (block.kind === 'figure' && block.figure !== undefined)
      out.push(
        <FigureFrame
          key={key}
          number={block.figure.number}
          title={block.figure.title}
          unit={block.figure.unit}
          period={block.figure.period}
          sources={block.figure.sources}
          note={figureNotes[String(block.figure.number)]?.note}
          partSlug={partSlug}
        >
          <p className="border border-dashed border-border p-6 text-report-small text-muted-foreground">
            {ui.figure.pending}
          </p>
        </FigureFrame>,
      );
    else
      out.push(
        <p key={key} className="my-4 max-w-[64ch]">
          {text}
        </p>,
      );
  });
  closeList('end');
  return <>{out}</>;
}
