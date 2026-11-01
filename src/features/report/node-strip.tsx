import { useContent } from './use-content';
import { NodeRef } from './node-ref';

/** The nodes that one part names, as a row of references at the start of the part. */
export function NodeStrip({ nodeIds }: { readonly nodeIds: readonly string[] }) {
  const { ui } = useContent();
  if (nodeIds.length === 0) return null;
  return (
    <div className="mt-6">
      <ul aria-label={ui.part.nodes} className="flex flex-wrap gap-x-4 gap-y-1 text-report-small">
        {nodeIds.map((id) => (
          <li key={id} className="flex min-h-11 items-center">
            <NodeRef id={id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
