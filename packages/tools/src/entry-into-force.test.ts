import { expect, test } from 'vitest';

import { endBeforeEntryIntoForce, entryIntoForce } from './entry-into-force.ts';
import { statedBounds } from './stated-value.ts';

const ON_PUBLICATION =
  'Article 2\nThis Regulation shall enter into force on the date of its publication in the ' +
  'Official Journal of the European Union.\nDone at Brussels, 22 September 2026.\nEN OJ L, 22.9.2026';

test('an act in force on the day of its publication: the day of the Official Journal', () => {
  expect(entryIntoForce(ON_PUBLICATION)).toBe('2026-09-22');
  expect(endBeforeEntryIntoForce('2026-09-21', [ON_PUBLICATION])).toBe(true);
  expect(endBeforeEntryIntoForce('2026-09-22', [ON_PUBLICATION])).toBe(false);
});

test('an act in force on the day after its publication, or the twentieth day after', () => {
  const next =
    'This Regulation shall enter into force on the day following that of its publication in ' +
    'the Official Journal of the European Union. OJ L, 24.6.2024';
  expect(entryIntoForce(next)).toBe('2024-06-25');
  expect(endBeforeEntryIntoForce('2024-06-24', [next])).toBe(true);
  const twentieth = next.replace('the day following', 'the twentieth day following');
  expect(entryIntoForce(twentieth)).toBe('2024-07-14');
});

test('an act that names the day of its entry into force', () => {
  expect(
    entryIntoForce('This Decision shall enter into force on 1 March 2025. Official Journal'),
  ).toBe('2025-03-01');
});

test('a citation of another act gives no day of publication', () => {
  const article =
    'This Regulation shall enter into force on the date of its publication in the Official Journal.';
  expect(entryIntoForce(`${ON_PUBLICATION} (1) OJ L 229, 31.7.2014, p. 1.`)).toBe('2026-09-22');
  expect(entryIntoForce(`${article} (1) OJ L 229, 31.7.2014, p. 1.`)).toBeNull();
  expect(entryIntoForce(`${article} (1) OJ L, 2024/1745, 24.6.2024.`)).toBeNull();
  expect(entryIntoForce(`${article} OJ L, 22.9.2026 (1) OJ L, 23.9.2026, p. 4.`)).toBe(
    '2026-09-22',
  );
  // Two page lines with two days give no day.
  expect(entryIntoForce(`${article} OJ L, 22.9.2026 and OJ L, 23.9.2026`)).toBeNull();
});

test('no day: no date, no Official Journal, two passages', () => {
  expect(
    entryIntoForce('shall enter into force on the date of its publication in the Official Journal'),
  ).toBeNull();
  expect(entryIntoForce('The order shall enter into force on 1 March 2025.')).toBeNull();
  // The article and the date in two passages give no day.
  expect(
    endBeforeEntryIntoForce('2026-09-21', [
      'This Regulation shall enter into force on the date of its publication in the Official Journal.',
      'EN OJ L, 22.9.2026',
    ]),
  ).toBe(false);
});

test('propose takes an end with the rule only when one passage gives the entry into force', () => {
  const act = {
    op: 'update_relation',
    targetId: 'b285380d-b9af-46bc-8837-2fc138be6704',
    validTo: '2026-09-21',
    endRule: 'day_before_entry_into_force',
  } as const;
  expect(statedBounds(act, [ON_PUBLICATION]).dropped).toStrictEqual([]);
  // The day of the Official Journal is in the passage, but the rule gives another end.
  expect(statedBounds({ ...act, validTo: '2026-09-22' }, [ON_PUBLICATION]).dropped).toStrictEqual([
    'validTo',
  ]);
  // With no rule, a day that the passage does not write is not stated.
  const plain = { op: act.op, targetId: act.targetId, validTo: act.validTo } as const;
  expect(statedBounds(plain, [ON_PUBLICATION]).dropped).toStrictEqual(['validTo']);
});
