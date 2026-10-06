import type { z } from 'zod';

import { refused, type Unwritten } from './statement.ts';

const NOT_JSON = 'the body is not a JSON object';

/** The body of one request, read through its shape before any client is asked. A body that is
 * not JSON is refused with one sentence, and a body that the shape refuses with `wrong`. */
export const readBody = <Shape extends z.ZodType>(
  raw: string,
  shape: Shape,
  wrong: string,
): { readonly outcome: 'read'; readonly body: z.output<Shape> } | Unwritten => {
  let given: unknown;
  try {
    given = JSON.parse(raw);
  } catch {
    return refused(NOT_JSON);
  }
  const held = shape.safeParse(given);
  return held.success ? { outcome: 'read', body: held.data } : refused(wrong);
};
