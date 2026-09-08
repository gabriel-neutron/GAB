// Two guards, two questions. The offline one proves the committed seed text states the
// declaration; this one proves the live rows do. A seed edited and never applied, and a row
// written by hand outside the generated region, both pass the offline guard and fail here.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { seededVocabulary } from '../src/shared/vocabulary/declarations.ts';
import { probe } from './probe.ts';

const entityTypeRows = z.array(
  z.object({
    key: z.string(),
    label: z.string(),
    colour_light: z.string(),
    colour_dark: z.string(),
    ord: z.number(),
    retired: z.boolean(),
  }),
);

const attributeKeyRows = z.array(
  z.object({
    key: z.string(),
    stem: z.string(),
    kind: z.string(),
    label: z.string(),
    unit: z.string().nullable(),
    pattern: z.string().nullable(),
    retired: z.boolean(),
  }),
);

const ENTITY_TYPES = `
  SELECT key, label, colour_light, colour_dark, ord, retired FROM public.entity_type`;

const ATTRIBUTE_KEYS = `
  SELECT key, stem, kind, label, unit, pattern, retired FROM public.attribute_key`;

// The database orders under its own collation, so both sides are ordered here instead.
const byKey = <T extends { readonly key: string }>(rows: readonly T[]): readonly T[] =>
  [...rows].sort((one, other) => (one.key < other.key ? -1 : one.key > other.key ? 1 : 0));

const { retiredWhenSeeded } = seededVocabulary;

test('entity_type holds every declared type and no other', async () => {
  const live = await probe('superuser', async (ask) =>
    entityTypeRows.parse(await ask(ENTITY_TYPES)),
  );

  expect(byKey(live)).toStrictEqual(
    byKey(seededVocabulary.entityTypes).map((row) => ({
      key: row.key,
      label: row.label,
      colour_light: row.colourLight,
      colour_dark: row.colourDark,
      ord: row.ord,
      retired: retiredWhenSeeded,
    })),
  );
});

test('attribute_key holds every declared key and no other', async () => {
  const live = await probe('superuser', async (ask) =>
    attributeKeyRows.parse(await ask(ATTRIBUTE_KEYS)),
  );

  expect(byKey(live)).toStrictEqual(
    byKey(seededVocabulary.attributeKeys).map((row) => ({
      key: row.key,
      stem: row.stem,
      kind: row.kind,
      label: row.label,
      unit: row.unit,
      pattern: row.pattern,
      retired: retiredWhenSeeded,
    })),
  );
});
