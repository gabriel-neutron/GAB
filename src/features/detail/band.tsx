import type { ReactNode } from 'react';

export interface BandProps {
  /** The name of one part of the dossier. It never names a group of the claims inside the
   * record: the vocabulary declares a key, a kind and a label, and it declares no group. */
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
