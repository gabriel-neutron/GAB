// A sentence ends with a full stop and its note markers, before a space and a capital or a quote.
const END = /(?<=\.(?:\[\^[^\]]+\])*)\s+(?=[A-Z"“])/;

/** The sentences of one block of report text, unchanged: joined with a space, they give the text. */
export function splitSentences(text: string): readonly string[] {
  return text.split(END);
}
