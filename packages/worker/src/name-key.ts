/** The same form as name_key() in the record: one space, lower case, no edge space. Two names that
 * have the same key are one name. */
export const nameKey = (name: string): string => name.replace(/\s+/gu, ' ').trim().toLowerCase();
