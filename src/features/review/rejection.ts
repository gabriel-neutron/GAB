// Departure: two exports, one job. The list of reasons and the rule that holds back a rejection
// are the rule of one field of the screen. The database holds the same rule, and words its own
// refusal.

/** The seven reasons of a rejection, as the record stores them and as the operator reads them. */
export const REJECTION_REASONS = [
  { key: 'wrong_value', words: 'Wrong value' },
  { key: 'not_in_source', words: 'Not in the source' },
  { key: 'wrong_type', words: 'Wrong type' },
  { key: 'duplicate', words: 'Duplicate' },
  { key: 'out_of_scope', words: 'Out of scope' },
  { key: 'end_rejected', words: 'End rejected' },
  { key: 'other', words: 'Other' },
] as const;

// Origin of the number: decided with the operator. One line explains a rejection.
const LONGEST_NOTE = 500;

/** Why the rejection cannot go yet, or null when it can. The reason is a key of the list, or an
 * empty text before the operator chooses one. */
export function rejectionGap(reason: string, note: string): string | null {
  if (!REJECTION_REASONS.some((held) => held.key === reason)) return 'Choose a reason.';
  const written = note.trim();
  if (reason === 'other' && written === '') return 'Write the reason in the note.';
  if (written.length > LONGEST_NOTE) return 'The note is 500 characters at most.';
  return null;
}
