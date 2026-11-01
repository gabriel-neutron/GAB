// A sentence ends with a full stop and its note markers, before a space and a capital or a quote
// (a French capital can have an accent, and a French quote is a guillemet).
const END = /(?<=\.(?:\[\^[^\]]+\])*)\s+(?=[A-ZÀ-Ý"“«])/;

/** The sentences of one block of report text, unchanged: joined with a space, they give the text. */
export function splitSentences(text: string): readonly string[] {
  return text.split(END);
}
