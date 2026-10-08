/** The text as one sentence: a full stop is added only where the text does not end with one. */
export const withFullStop = (text: string): string =>
  /[.!?]$/u.test(text.trimEnd()) ? text.trimEnd() : `${text.trimEnd()}.`;
