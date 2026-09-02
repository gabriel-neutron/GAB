import { z } from 'zod';

import { ATTRIBUTE_KIND, type AttributeVocabulary } from './vocabulary.ts';

const scalar = z.union([z.string(), z.number(), z.boolean()]);

// `v` alone, and the object is strict. The sources of an edit are attached by the writer from
// what the row already cites, so a caller that sends `src` is refused and never obeyed.
const edited = z.strictObject({ v: z.union([scalar, z.array(scalar)]) });

export type AttributeEdit = Record<string, z.infer<typeof edited>>;

const kindHolds = (kind: string, value: z.infer<typeof edited>['v']): boolean => {
  if (kind === ATTRIBUTE_KIND.quantity) return typeof value === 'number';
  if (kind === ATTRIBUTE_KIND.boolean) return typeof value === 'boolean';
  if (kind === ATTRIBUTE_KIND.list) return Array.isArray(value);
  return typeof value === 'string';
};

const breaksPattern = (pattern: string, value: z.infer<typeof edited>['v']): boolean => {
  const shape = new RegExp(pattern);
  if (Array.isArray(value)) return value.some((element) => !shape.test(String(element)));
  if (typeof value === 'string') return !shape.test(value);
  return false;
};

/** The attributes of one edit, checked against the live vocabulary of the database. */
export const attributeEdit = (vocabulary: AttributeVocabulary) => {
  const declared = new Map(vocabulary.map((entry) => [entry.key, entry]));

  return z.record(z.string(), edited).superRefine((edit, ctx) => {
    for (const [key, value] of Object.entries(edit)) {
      const entry = declared.get(key);
      if (entry === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is not a declared key` });
        continue;
      }
      if (entry.retired) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is retired` });
        continue;
      }
      if (!kindHolds(entry.kind, value.v)) {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'v'],
          message: `the value of ${key} is not ${entry.kind}, which the key declares`,
        });
        continue;
      }
      if (entry.pattern !== null && breaksPattern(entry.pattern, value.v))
        ctx.addIssue({
          code: 'custom',
          path: [key, 'v'],
          message: `${key} does not match the format ${entry.pattern}`,
        });
    }
  });
};
