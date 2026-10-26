import type { ReactNode } from 'react';

import { CAPTION, DATA } from './style';

export interface BandProps {
  /** Departure: the name of one part of the dossier, and never of a group of claims inside the
   * record. Nothing describes a key (M11), so nothing puts two claims in one group. */
  readonly name: string;
  /** Absent where the part holds no list to count. */
  readonly count?: number;
  readonly children: ReactNode;
}

/** A section of the panel: a `divider` hairline, a `caption` title, and no card around it. */
export function Band({ name, count, children }: BandProps) {
  return (
    <section
      data-part=""
      aria-label={name}
      className="flex flex-col gap-3 border-t border-divider pt-4"
    >
      <h2 className="flex items-baseline gap-2">
        <span className={CAPTION}>{name}</span>
        {count === undefined ? null : (
          <span className={`${DATA} text-muted-foreground`}>{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
