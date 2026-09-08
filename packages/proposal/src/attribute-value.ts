import { z } from 'zod';

const scalar = z.union([z.string(), z.number(), z.boolean()]);

// `v` alone, and the object is strict. The sources of an edit are attached by the writer from
// what the row already cites, so a caller that sends `src` is refused and never obeyed.
const edited = z.strictObject({ v: z.union([scalar, z.array(scalar)]) });

export type AttributeEdit = Record<string, z.infer<typeof edited>>;

/** The shape of a key, and nothing about what the key means. `attrs_valid` holds the same two
 * rules in the record, so a key the database refuses never leaves the browser. A screen that
 * mints a key reads them, and it refuses one in words before it spends a round trip. */
export const ATTRIBUTE_KEY = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/** The longest identifier the record takes. */
export const ATTRIBUTE_KEY_LENGTH = 63;

const KEY_SHAPE =
  'a key is lower case words of letters and digits, joined by one underscore.' +
  ' It starts with a letter, and it ends with a letter or a digit.' +
  ` It is ${String(ATTRIBUTE_KEY_LENGTH)} characters at most`;

/** The attributes of one edit. THE SHAPE IS THE WHOLE RULE: a key, and a value that is a scalar
 * or a flat list of them. No kind, no format and no list of permitted keys, because M11 says the
 * free half of the model carries none, and the database holds exactly the same line. */
export const attributeEdit = () =>
  z.record(z.string().regex(ATTRIBUTE_KEY).max(ATTRIBUTE_KEY_LENGTH), edited, {
    // The record states `Invalid key in record`. The sentence of the key schema sits nested
    // under it, where the composer of the writer never reads it. Only the key fault is renamed,
    // because a sentence on the record would answer a body that is no record at all.
    error: (issue) => (issue.code === 'invalid_key' ? KEY_SHAPE : undefined),
  });
