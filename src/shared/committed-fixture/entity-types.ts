/**
 * The types the seed of the database declares, as a story reads them. A story reaches no
 * database, so it carries this; the application reads the live rows and never this file. */

import type { TypeVocabulary } from '../read/model';
import { seededVocabulary } from '../vocabulary/declarations.ts';

// A story takes no print order, so `ord` is dropped here and nowhere else.
export const entityTypes: TypeVocabulary = seededVocabulary.entityTypes.map(
  ({ key, label, colourLight, colourDark }) => ({ key, label, colourLight, colourDark }),
);
