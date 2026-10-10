import { disclaimerBlocks, type DisclaimerRun } from './disclaimer-blocks.ts';
import { LINK } from './site-style.ts';

function Runs({ runs }: { readonly runs: readonly DisclaimerRun[] }) {
  return runs.map((run, index) => {
    const key = `${String(index)} ${run.text}`;
    if (run.kind === 'strong') return <strong key={key}>{run.text}</strong>;
    if (run.kind === 'link')
      return (
        <a key={key} className={LINK} href={run.text}>
          {run.text}
        </a>
      );
    return <span key={key}>{run.text}</span>;
  });
}

/** The disclaimer of the dataset, as the release gives it. */
export function DisclaimerText({ markdown }: { readonly markdown: string }) {
  return (
    <div className="flex max-w-prose flex-col gap-2">
      {disclaimerBlocks(markdown).map((block, index) =>
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
