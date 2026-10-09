import { z } from 'zod';

/** An author that the worker may compare with: a known author, or one of the approved reference
 * set. The record gives it through `rating_context`. */
const knownAuthor = z.object({
  name: z.string(),
  letter: z.string(),
  reason: z.string(),
  controller: z.string().nullable(),
  party: z.boolean(),
  reference: z.boolean(),
  names: z.array(z.string()),
});

export type KnownAuthor = z.infer<typeof knownAuthor>;

/** What the record gives to rate one name: the name has an author already, or the known authors. */
export const ratingContext = z.discriminatedUnion('resolved', [
  z.object({ resolved: z.literal(true) }),
  z.object({ resolved: z.literal(false), authors: z.array(knownAuthor) }),
]);

/** The answer of the model: the same author as a known one, or a new author with a letter. A
 * letter A or B is in the shape so that code refuses it with a sentence the operator can read. */
export const ratingAnswer = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('same'), as: z.string() }),
  z.strictObject({
    kind: z.literal('new'),
    letter: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
    reason: z.string(),
    references: z.array(z.string()),
    controller: z.string().nullable(),
    party: z.boolean(),
  }),
]);

export type RatingAnswer = z.infer<typeof ratingAnswer>;

/** What code does with an answer: the door to call and its values, or the sentence of a refusal. */
export type Decision =
  | { readonly kind: 'join'; readonly known: string }
  | {
      readonly kind: 'store';
      readonly letter: 'C' | 'D' | 'E' | 'F';
      readonly reason: string;
      readonly references: readonly string[];
      readonly controller: string | null;
      readonly party: boolean;
    }
  | {
      readonly kind: 'refused';
      readonly reason: string;
      /** True when the answer compares with an author outside the reference set. The rater asks
       * the model again once for this refusal, and for no other. */
      readonly outsideSet?: true;
    };

// The same form as name_key() in the record: one space, lower case, no edge space.
const keyOf = (name: string): string => name.replace(/\s+/gu, ' ').trim().toLowerCase();

const refuse = (reason: string): Decision => ({ kind: 'refused', reason });

/** The names of the reference set, as the record gives them. The model may compare with these
 * names only. */
export const referenceNames = (authors: readonly KnownAuthor[]): string[] =>
  authors.filter((one) => one.reference).map((one) => one.name);

/** Judges one answer against the known authors. A refused answer stores nothing, so the author
 * stays F. The record checks the same rules again in its doors. */
export const decide = (
  name: string,
  given: RatingAnswer,
  authors: readonly KnownAuthor[],
): Decision => {
  if (given.kind === 'same') {
    const known = authors.find((one) =>
      [one.name, ...one.names].some((word) => keyOf(word) === keyOf(given.as)),
    );
    if (known === undefined)
      return refuse(
        `the answer joins "${name}" to "${given.as}", and no known author has that name`,
      );
    return { kind: 'join', known: known.name };
  }

  if (given.letter === 'A' || given.letter === 'B')
    return refuse(
      `the answer gives the letter ${given.letter}. The worker gives C to F, and A and B come ` +
        'from the reference set',
    );
  if (given.reason.trim() === '') return refuse('the answer gives no reason for the letter');

  const reference = authors.filter((one) => one.reference);
  const compared = given.references.map((word) =>
    reference.find((one) => [one.name, ...one.names].some((known) => keyOf(known) === keyOf(word))),
  );
  if (compared.length === 0)
    return refuse('the answer names no reference author that it compared with');
  const stranger = given.references.find((_word, index) => compared[index] === undefined);
  if (stranger !== undefined)
    return {
      kind: 'refused',
      reason: `the answer compares with "${stranger}", and the reference set has no such author`,
      outsideSet: true,
    };

  const controller = given.controller?.trim() ?? '';
  if (given.party && controller === '')
    return refuse('the answer gives a party to the conflict with no controller');

  return {
    kind: 'store',
    letter: given.letter,
    reason: given.reason.trim(),
    references: compared.flatMap((one) => (one === undefined ? [] : [one.name])),
    controller: controller === '' ? null : controller,
    party: given.party,
  };
};
