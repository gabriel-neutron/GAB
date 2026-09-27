import type { ReactNode } from 'react';

export interface BandProps {
  /** Departure: the name of one part of the dossier, and never of a group of claims inside the
   * record. Nothing describes a key (M11), so nothing puts two claims in one group. */
  readonly name: string;
  readonly count: number;
  readonly children: ReactNode;
}

const NAME = 'text-small/4 tracking-caps text-label uppercase';

const COUNT = 'font-mono text-small/4 tabular-nums text-label';

export function Band({ name, count, children }: BandProps) {
  return (
    <section data-part="" aria-label={name} className="border-t border-border pt-2">
      <h2 className="flex items-baseline gap-2 pb-1">
        <span className={NAME}>{name}</span>
        <span className={COUNT}>{count}</span>
      </h2>
      {children}
    </section>
  );
}
