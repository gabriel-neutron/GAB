import { disclaimerBlocks, type DisclaimerRun } from '@gab/release/disclaimer-blocks';
import { READING_LINK } from './reading-link';
import { safeHref } from '@gab/release/safe-href';

function Runs({ runs }: { readonly runs: readonly DisclaimerRun[] }) {
  return runs.map((run, index) => {
    const key = `${String(index)} ${run.text}`;
    if (run.kind === 'strong') return <strong key={key}>{run.text}</strong>;
    const href = run.kind === 'link' ? safeHref(run.text) : null;
    if (href !== null)
      return (
        <a key={key} className={READING_LINK} href={href}>
          {run.text.replace(/^mailto:/u, '')}
        </a>
      );
    return <span key={key}>{run.text}</span>;
  });
}

export interface DisclaimerTextProps {
  readonly markdown: string;
  /** True drops the paragraphs that give a contact address, for a page that gives them itself. */
  readonly withoutContacts?: true;
}

/** The disclaimer of the dataset, as the release gives it. */
export function DisclaimerText({ markdown, withoutContacts }: DisclaimerTextProps) {
  return (
    <div className="flex max-w-prose flex-col gap-2">
      {disclaimerBlocks(markdown)
        .filter(
          (block) =>
            withoutContacts !== true ||
            block.kind === 'list' ||
            !block.runs.some((run) => run.kind === 'link'),
        )
        .map((block, index) =>
          block.kind === 'list' ? (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-4">
              {block.items.map((item, at) => (
                <li key={at}>
                  <Runs runs={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={index}>
              <Runs runs={block.runs} />
            </p>
          ),
        )}
    </div>
  );
}
