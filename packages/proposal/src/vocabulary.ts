import { z } from 'zod';

// The seven kinds an attribute key is declared with. The database holds the same seven words in
// a check constraint, and the writer reads the live rows rather than a copy of them.
export const ATTRIBUTE_KIND = {
  quantity: 'quantity',
  identifier: 'identifier',
  text: 'text',
  note: 'note',
  date: 'date',
  boolean: 'boolean',
  list: 'list',
} as const;

// `pattern` is a POSIX regular expression written by the seed, and the browser and the writer
// both read it with `RegExp`. The two dialects agree on the anchors and the classes used here.
const declaration = z.object({
  key: z.string(),
  kind: z.enum(ATTRIBUTE_KIND),
  pattern: z.string().nullable(),
  retired: z.boolean(),
});

/** Every attribute key the database declares, read from `attribute_key` and never hard-coded. */
export const attributeVocabulary = z.array(declaration);

export type AttributeVocabulary = z.infer<typeof attributeVocabulary>;
