/**
 * The declarations the seed of the database writes, as a story reads them. A story reaches no
 * database, so it carries this; the application reads the live rows and never this file. */

import type { Vocabulary } from '../read/model';
import { seededVocabulary } from '../vocabulary/declarations.ts';

// A story states every live key, and `stem` reaches no surface, so it is dropped here.
export const vocabulary: Vocabulary = seededVocabulary.attributeKeys.map(
  ({ key, kind, label, unit, pattern }) => ({
    key,
    kind,
    label,
    unit,
    pattern,
    retired: seededVocabulary.retiredWhenSeeded,
  }),
);
