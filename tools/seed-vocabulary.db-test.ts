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

const ENTITY_TYPES = `
  SELECT key, label, colour_light, colour_dark, ord, retired FROM public.entity_type`;

const present = z.array(z.object({ held: z.boolean() }));

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

// THE TABLE IS GONE, AND THIS IS WHAT SAYS SO. M11 leaves the free half of the model with no
// vocabulary at all, and migration 0010 dropped `attribute_key`. A later migration that brought
// it back would pass every other test in this repository and fail here.
test('no attribute vocabulary exists', async () => {
  const held = await probe('superuser', async (ask) =>
    present.parse(await ask(`SELECT to_regclass('public.attribute_key') IS NOT NULL AS held`)),
  );
  expect(held).toStrictEqual([{ held: false }]);
});
