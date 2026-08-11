/**
 * PROTOTYPE — throwaway. Three variations of what one row of the index says.
 *
 * The operator chose the two-step rail on 11 August 2026, so the rail is no longer under
 * review. What is under review is the row: a name alone does not tell two similar entities
 * apart, and the corpus carries more than a name.
 *
 * ------------------------------------------------------------------------------------------
 * The question under the question
 * ------------------------------------------------------------------------------------------
 *
 * "One attribute per type" needs a rule that says **which** attribute, and a hand-kept table of
 * "the key that matters for a vessel" is exactly what ADR 0005 §6 forbids the operator to
 * maintain. So the three variations disagree about the rule as well as the layout:
 *
 * - **R1** and **R3** use `typeKeyOf`: the key that the most entities of a type carry. One
 *   field per type, comparable down the column, **blank** where an entity does not carry it.
 * - **R2** uses `ownKeyOf`: the first key of that entity. Never blank, never comparable.
 *
 * Neither rule names an attribute. The real key names belong to **#12**, and nothing here
 * settles them.
 */

import type { AttributeValue } from '@/shared/fixtures/types';
import { entityTypes, geoEntities, type GeoEntity } from './prototype-corpus';
import { el, MONO, TRUNCATE } from './prototype-dom';

export const ROW_KEYS = ['R1', 'R2', 'R3'] as const;
export type RowKey = (typeof ROW_KEYS)[number];

/**
 * M7: a value is a scalar or a flat list, and never an object. A list is the only case that
 * needs work, and `typeof` narrows to it without `Array.isArray`, which loses `readonly`.
 */
function showValue(value: AttributeValue): string {
  return typeof value === 'object' ? value.join(', ') : String(value);
}

/** `throughput_kt_month` reads as a machine key. The row is for a person. */
const showKey = (key: string): string => key.replace(/_/g, ' ');

/**
 * The key that the most entities of this type carry. A tie goes to the alphabet, so the choice
 * never depends on the order of the fixture. Computed once, from the corpus, by the machine —
 * nobody maintains it, and a type that shares no key at all returns `null`.
 */
function computeTypeKey(type: string): string | null {
  const tally = new Map<string, number>();
  for (const entity of geoEntities) {
    if (entity.type !== type) continue;
    for (const key of Object.keys(entity.attrs)) tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  const ranked = [...tally.entries()].sort(
    ([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB),
  );
  return ranked[0]?.[0] ?? null;
}

const TYPE_KEYS: ReadonlyMap<string, string | null> = new Map(
  entityTypes.map((type) => [type, computeTypeKey(type)]),
);

export const typeKeyOf = (type: string): string | null => TYPE_KEYS.get(type) ?? null;

/** The value of the type's key on one entity, or nothing. M9: the unknown is a missing key. */
function typeValueOf(entity: GeoEntity): string | null {
  const key = typeKeyOf(entity.type);
  if (key === null) return null;
  const attribute = entity.attrs[key];
  return attribute === undefined ? null : showValue(attribute.v);
}

/** The first key this entity carries, in the order of the alphabet. */
function ownKeyOf(entity: GeoEntity): readonly [string, string] | null {
  const [key] = Object.keys(entity.attrs).sort((a, b) => a.localeCompare(b));
  if (key === undefined) return null;
  const attribute = entity.attrs[key];
  return attribute === undefined ? null : [key, showValue(attribute.v)];
}

export interface RowStyle {
  readonly name: string;
  /** The rail takes its width from the row, because the row is what has to fit. */
  readonly railWidth: number;
  /**
   * What the group header adds after the type. A column of blanks is only readable when the
   * header says what the column holds, so a variation that can be blank must fill this in.
   */
  readonly groupNote: (type: string) => string | null;
  readonly render: (entity: GeoEntity, selected: boolean, onPick: () => void) => HTMLElement;
}

function shell(selected: boolean, onPick: () => void, column: boolean): HTMLElement {
  const row = el('div', {
    display: 'flex',
    flexDirection: column ? 'column' : 'row',
    alignItems: column ? 'stretch' : 'center',
    gap: column ? '0' : '8px',
    padding: '4px 8px 4px 22px',
    cursor: 'pointer',
    background: selected ? 'var(--accent)' : 'transparent',
  });
  row.addEventListener('click', onPick);
  return row;
}

const figure = (text: string, width: string): HTMLElement =>
  el(
    'span',
    {
      ...TRUNCATE,
      fontFamily: MONO,
      fontSize: '11px',
      color: 'var(--muted-foreground)',
      width,
      // Rule 13: a column of figures must line up, so it is right aligned and fixed in width.
      textAlign: 'right',
      flex: `0 0 ${width}`,
    },
    text,
  );

export const ROW_STYLES: Readonly<Record<RowKey, RowStyle>> = {
  /**
   * **R1 — Type key, one line.** The densest of the three: one line, the name truncating, and
   * one right-aligned column that holds the same field for every row of a type. A blank means
   * the entity does not carry that key, and the group header names the key so a blank reads as
   * an absence and not as a fault.
   *
   * **What it puts at risk.** 78px is not enough for a registration number, and a type whose
   * entities share no key gets a column of nothing.
   */
  R1: {
    name: 'Type key, one line',
    railWidth: 240,
    groupNote: (type) => typeKeyOf(type),
    render: (entity, selected, onPick) => {
      const row = shell(selected, onPick, false);
      row.append(
        el('span', { ...TRUNCATE, flex: '1' }, entity.label),
        figure(typeValueOf(entity) ?? '', '78px'),
      );
      return row;
    },
  },

  /**
   * **R2 — Own key, two lines.** Each row shows the first attribute it carries, with its key,
   * under a name that never has to truncate. Nothing is ever blank.
   *
   * **What it puts at risk.** Half the rows on a screen, and the column cannot be read down:
   * one row says an IMO and the next says a berth count, so the eye has no ladder.
   */
  R2: {
    name: 'Own key, two lines',
    railWidth: 240,
    groupNote: () => null,
    render: (entity, selected, onPick) => {
      const row = shell(selected, onPick, true);
      const own = ownKeyOf(entity);
      row.appendChild(el('span', { ...TRUNCATE }, entity.label));
      if (own !== null) {
        const [key, value] = own;
        const line = el('div', {
          ...TRUNCATE,
          fontFamily: MONO,
          fontSize: '11px',
          color: 'var(--muted-foreground)',
        });
        line.append(el('span', { opacity: '0.7' }, `${showKey(key)} `), el('span', {}, value));
        row.appendChild(line);
      }
      return row;
    },
  },

  /**
   * **R3 — Key first, wide rail.** The reading order is inverted: the identifier leads and the
   * name follows in grey. For an analyst working from a document full of numbers rather than
   * names. It needs 300px, which is the width the two-step rail was chosen to avoid.
   *
   * **What it puts at risk.** An entity with no value for the type key leaves a hole at the
   * start of the row, so the ladder the variation is built on breaks exactly where the corpus
   * is thin.
   */
  R3: {
    name: 'Key first, wide rail',
    railWidth: 300,
    groupNote: (type) => typeKeyOf(type),
    render: (entity, selected, onPick) => {
      const row = shell(selected, onPick, false);
      const value = typeValueOf(entity);
      row.append(
        el(
          'span',
          {
            ...TRUNCATE,
            fontFamily: MONO,
            fontSize: '11px',
            width: '96px',
            flex: '0 0 96px',
            color: value === null ? 'var(--muted-foreground)' : 'var(--foreground)',
          },
          value ?? '',
        ),
        el('span', { ...TRUNCATE, flex: '1', color: 'var(--muted-foreground)' }, entity.label),
      );
      return row;
    },
  },
};

export function parseRow(value: unknown): RowKey {
  if (typeof value !== 'string') return 'R1';
  return ROW_KEYS.find((key) => key === value) ?? 'R1';
}

export function nextRow(current: RowKey, step: number): RowKey {
  const at = ROW_KEYS.indexOf(current);
  return ROW_KEYS[(at + step + ROW_KEYS.length) % ROW_KEYS.length] ?? 'R1';
}
