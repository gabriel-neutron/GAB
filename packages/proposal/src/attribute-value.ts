import { z } from 'zod';

const scalar = z.union([z.string(), z.number(), z.boolean()]);

// `v` alone, and the object is strict. The writer attaches the sources of an edit, so a caller
// that sends `src` is refused and never obeyed.
const edited = z.strictObject({ v: z.union([scalar, z.array(scalar)]) });

export type AttributeEdit = Record<string, z.infer<typeof edited>>;

/** The attributes of one edit: a key, and a value that is a scalar or a flat list of them. The
 * database holds the shape of a key and refuses a blank text, and it words the refusal. */
export const attributeEdit = z.record(z.string(), edited);
