// A comment line starts with `//`, `/*` or `*`, or lies inside an open block comment.
// A code line is any other line that holds a character. Every gate reads this file.

export const LIMITS = {
  blockLines: 3,
  lineChars: 100,
} as const;

interface Block {
  readonly line: number;
  readonly lines: number;
}

interface LongLine {
  readonly line: number;
  readonly chars: number;
}

export interface Measurement {
  readonly commentLines: number;
  readonly codeLines: number;
  readonly commentChars: number;
  readonly overBlocks: readonly Block[];
  readonly longLines: readonly LongLine[];
}

interface Open {
  line: number;
  lines: number;
}

// A `/*` inside a string or after a `//` opens nothing. Both are dropped before the test,
// or one quoted brace in a code line reads the rest of the file as one comment.
const code = (line: string): string => {
  const bare = line.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
  const slash = bare.indexOf('//');
  return slash === -1 ? bare : bare.slice(0, slash);
};

const opens = (trimmed: string): boolean => {
  const bare = code(trimmed);
  const start = bare.lastIndexOf('/*');
  return start !== -1 && !bare.slice(start).includes('*/');
};

const flush = (open: Open | null, blocks: Block[]): null => {
  if (open) blocks.push({ line: open.line, lines: open.lines });
  return null;
};

export const measure = (text: string): Measurement => {
  const blocks: Block[] = [];
  const longLines: LongLine[] = [];
  let commentLines = 0;
  let codeLines = 0;
  let commentChars = 0;
  let inBlock = false;
  let open: Open | null = null;

  text.split('\n').forEach((raw, index) => {
    const trimmed = raw.trim();
    const isComment =
      inBlock ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      // A comment in JSX opens with `{/*`, so a test on `/*` alone reads it as a code line.
      trimmed.startsWith('{/*');

    if (inBlock && trimmed.includes('*/')) inBlock = false;
    else if (!inBlock && opens(trimmed)) inBlock = true;

    if (trimmed === '') return;

    if (!isComment) {
      codeLines += 1;
      open = flush(open, blocks);
      return;
    }

    commentLines += 1;
    commentChars += trimmed.length;
    if (raw.length > LIMITS.lineChars) longLines.push({ line: index + 1, chars: raw.length });
    // A blank line between two comment runs does not end a block, so a split earns nothing.
    open ??= { line: index + 1, lines: 0 };
    open.lines += 1;
  });

  flush(open, blocks);

  return {
    commentLines,
    codeLines,
    commentChars,
    overBlocks: blocks.filter((block) => block.lines > LIMITS.blockLines),
    longLines,
  };
};

export const ratio = (commentLines: number, codeLines: number): number =>
  commentLines + codeLines === 0 ? 0 : commentLines / (commentLines + codeLines);
