import { ui } from './content';
import { NodeRef } from './node-ref';

/** The nodes that one part names, as a row of references at the start of the part. */
export function NodeStrip({ nodeIds }: { readonly nodeIds: readonly string[] }) {
  if (nodeIds.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="font-mono text-caption uppercase text-label">
        {ui.part.nodes} · <span className="tabular-nums">{nodeIds.length}</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
        {nodeIds.map((id) => (
          <li key={id} className="flex min-h-11 items-center">
            <NodeRef id={id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
