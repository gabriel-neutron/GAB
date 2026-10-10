// An IMO number is seven digits. A writer can give it as a number, or with the prefix "IMO". A
// list or any other shape gives no number. The alignment matrix of the release reads the number
// with the same rule, so a vessel of the matrix has a page.
const PREFIX = /^IMO\s*/iu;
const SEVEN_DIGITS = /^\d{7}$/u;

/** The IMO number of the text of an `imo` value, or null when the text holds no number. */
export const imoOf = (text: string): string | null => {
  const digits = text.trim().replace(PREFIX, '');
  return SEVEN_DIGITS.test(digits) ? digits : null;
};
