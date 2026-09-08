import { z } from 'zod';

const scalar = z.union([z.string(), z.number(), z.boolean()]);

// `v` alone, and the object is strict. The sources of an edit are attached by the writer from
// what the row already cites, so a caller that sends `src` is refused and never obeyed.
const edited = z.strictObject({ v: z.union([scalar, z.array(scalar)]) });

export type AttributeEdit = Record<string, z.infer<typeof edited>>;

/** The attributes of one edit. THE SHAPE IS THE WHOLE RULE: a key, and a value that is a scalar
 * or a flat list of them. No kind, no format and no list of permitted keys, because M11 says the
 * free half of the model carries none, and the database holds exactly the same line. */
export const attributeEdit = () => z.record(z.string(), edited);
