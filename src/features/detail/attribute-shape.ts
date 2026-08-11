/**
 * **PROTOTYPE — throwaway.** UC1: the attribute set is unstructured, so the control is chosen
 * from the **value**, not from a declared type.
 *
 * **This is a finding, not a design.** Nothing in the model says that `incorporated_on` is a
 * date and `imo` is a text. The rule below reads the shape of the value and guesses, so
 * `registration_number` gets a text box and `coal_stock_t` gets a number box. The guess is right
 * on the sample and it is a guess. Reported to #46.
 *
 * Every control the screen draws from this is **disabled**. The write path is a proposal
 * (P1, invariant 5) and #42 is open and blocking, so this shows the shape of an edit surface
 * and writes nothing.
 */

import type { AttributeValue } from '@/shared/fixtures/types';

export type AttributeShape =
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'date'; readonly value: string }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'note'; readonly value: string }
  | { readonly kind: 'list'; readonly value: readonly (string | number)[] };

/** ISO 8601, date only. A timestamp is not in the sample, so nothing guesses at one. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Above this a single-line box hides the end of the value, so the control becomes a note. */
const NOTE_LENGTH = 48;

export function shapeOf(value: AttributeValue): AttributeShape {
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') return { kind: 'number', value };
  if (typeof value === 'object') return { kind: 'list', value };
  if (DATE_ONLY.test(value)) return { kind: 'date', value };
  if (value.length > NOTE_LENGTH || value.includes('\n')) return { kind: 'note', value };
  return { kind: 'text', value };
}

/** The word the screen shows beside the control, so the guess above is visible and arguable. */
export function shapeWord(shape: AttributeShape): string {
  switch (shape.kind) {
    case 'boolean':
      return 'yes or no';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'note':
      return 'long text';
    case 'text':
      return 'text';
    case 'list':
      return `list of ${shape.value.length}`;
  }
}

/** A key such as `coal_stock_t` reads badly as a heading. This is presentation, not a rename. */
export function keyToLabel(key: string): string {
  return key.replaceAll('_', ' ');
}
