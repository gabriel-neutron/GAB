import { GitMerge, Minus, Pencil, Plus } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { ChangeKind } from './queue';

export interface ChangeMarkProps {
  readonly kind: ChangeKind;
  /** The word of the kind. The hue is never the only mark, and an icon never labels alone. */
  readonly kindWords: string;
}

/** An addition, a modification and a deletion are three risks, so they take three hues. A merge
 * takes rows away, so it carries the weight of the family that destroys. */
export const KIND_PAINT: Readonly<Record<ChangeKind, string>> = {
  add: 'text-added',
  edit: 'text-candidate',
  delete: 'text-dissent',
  merge: 'text-dissent',
};

const GLYPH: Readonly<Record<ChangeKind, typeof Plus>> = {
  add: Plus,
  edit: Pencil,
  delete: Minus,
  merge: GitMerge,
};

/** The mark of a kind, in a hue and in a word. The chip and the glyph are one job: a card has
 * room for the word and a line of a list has not, and both must say the same thing. */
export function ChangeMark({ kind, kindWords }: ChangeMarkProps) {
  const Glyph = GLYPH[kind];
  return (
    <span
      data-kind={kind}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 px-1 text-small/4',
        KIND_PAINT[kind],
      )}
    >
      <Glyph size={14} aria-hidden="true" />
      {kindWords}
    </span>
  );
}

/** The same mark where a line has no room for the word. A reader still receives the word. */
export function KindGlyph({ kind, kindWords }: ChangeMarkProps) {
  const Glyph = GLYPH[kind];
  return (
    <span data-kind={kind} title={kindWords} className={cn('shrink-0', KIND_PAINT[kind])}>
      <Glyph size={14} aria-hidden="true" />
      <span className="sr-only">{kindWords}</span>
    </span>
  );
}
