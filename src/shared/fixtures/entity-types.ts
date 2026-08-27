/**
 * The types the seed of the database declares, as a story reads them. A story reaches no
 * database, so it carries this; the application reads the live rows and never this file. */

import type { TypeVocabulary } from '../read/model';

const declared = (
  key: string,
  label: string,
  colourLight: string,
  colourDark: string,
  ord: number,
): TypeVocabulary[number] => ({ key, label, colourLight, colourDark, ord, retired: false });

// `unknown` takes the grey: it is what lets a promotion complete when the extracted word is not
// a live type, and a grey says that no type was recognised.
export const entityTypes: TypeVocabulary = [
  declared('vessel', 'Vessel', '#2971c6', '#70adfb', 10),
  declared('facility', 'Facility', '#007989', '#00c2d2', 20),
  declared('company', 'Company', '#007d50', '#53c48e', 30),
  declared('person', 'Person', '#677000', '#a8b44b', 40),
  declared('unknown', 'Unknown', '#6b7280', '#9ca3af', 900),
];
