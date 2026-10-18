/** One run of the text of a block: plain words, strong words, or a link. */
export type DisclaimerRun =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string };

/** One block of the disclaimer: a paragraph, or a list of items. */
export type DisclaimerBlock =
  | { readonly kind: 'paragraph'; readonly runs: readonly DisclaimerRun[] }
  | { readonly kind: 'list'; readonly items: readonly (readonly DisclaimerRun[])[] };

// The disclaimer of the dataset is Markdown with three forms only: paragraphs, a list, and
// strong words. The release puts the two contact addresses in it as plain addresses.
const ADDRESS = /(https:\/\/\S+?|mailto:\S+?)(?=\.?(?:\s|$))/gu;

const linked = (text: string): DisclaimerRun[] =>
  text
    .split(ADDRESS)
    .filter((part) => part !== '')
    .map((part) =>
      /^(https:\/\/|mailto:)/u.test(part)
        ? { kind: 'link', text: part }
        : { kind: 'text', text: part.replaceAll('`', '') },
    );

const runs = (text: string): DisclaimerRun[] =>
  text
    .split(/\*\*(.+?)\*\*/u)
    .flatMap((part, index) =>
      index % 2 === 1 ? [{ kind: 'strong', text: part } as const] : linked(part),
    );

/** The blocks of the disclaimer of the dataset, read from its Markdown. */
export const disclaimerBlocks = (markdown: string): readonly DisclaimerBlock[] =>
  markdown
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map((block) => {
      const lines = block.split('\n');
      return lines.every((line) => line.startsWith('- '))
        ? { kind: 'list', items: lines.map((line) => runs(line.slice(2))) }
        : { kind: 'paragraph', runs: runs(lines.join(' ')) };
    });
