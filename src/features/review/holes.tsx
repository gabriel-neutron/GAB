import { FileQuestion, GitMerge, MessageSquareDashed, SearchX, Trash2, Unlink } from 'lucide-react';

import type { Hole, HoleKind } from './queue';

export interface HolesProps {
  readonly holes: readonly Hole[];
}

const GLYPH: Readonly<Record<HoleKind, typeof SearchX>> = {
  argument: MessageSquareDashed,
  duplicate: SearchX,
  'link-sources': Unlink,
  'merge-result': GitMerge,
  'destroyed-row': Trash2,
  // A bin would say the act destroys the row. It changes a row that is not there.
  'absent-row': FileQuestion,
};

/** What this act lacks, and never what every act lacks: a line printed on every card tells a
 * reader nothing. The whole reason stays on the mark, for a pointer and for a reader. */
export function Holes({ holes }: HolesProps) {
  if (holes.length === 0) return null;

  return (
    <ul className="space-y-0.5">
      {holes.map((hole) => {
        const Glyph = GLYPH[hole.kind];
        return (
          <li
            key={hole.kind}
            data-hole={hole.kind}
            title={hole.long}
            className="flex items-center gap-1.5 text-small/4 text-label"
          >
            <Glyph size={14} aria-hidden="true" className="shrink-0" />
            {hole.short}
            <span className="sr-only">{hole.long}</span>
          </li>
        );
      })}
    </ul>
  );
}
