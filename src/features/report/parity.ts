import type { ReportBlock, ReportPart } from './content';

/** The source text of one locale, and the heading where each part starts in it. */
export interface Source {
  readonly text: string;
  /** In the order of the text: a part runs from its heading to the heading of the next part. */
  readonly starts: readonly (readonly [slug: string, heading: string])[];
}

interface ReadSource {
  /** The lines of body text of each part, in their order. */
  readonly body: ReadonlyMap<string, readonly string[]>;
  /** The caption of each numbered figure: its title line and its note line. */
  readonly captions: ReadonlyMap<number, { readonly slug: string; readonly text: string }>;
  readonly notes: ReadonlyMap<string, string>;
}

const NOTE_LINE = /^\[\^([^\]]+)\]: (.*)$/;
const FIGURE_LINE = /^FIGURE: Figure (\d+): /;
const NOTE_OF_FIGURE = '*Note.* ';

/** Read a source text: the body of each part, the figure captions and the notes. A heading, the
 * text inside a figure and the title of a figure with no number are not body text. */
export function readSource(source: Source): ReadSource {
  const body = new Map<string, string[]>();
  const captions = new Map<number, { slug: string; text: string }>();
  const notes = new Map<string, string>();
  const headings = new Map(source.starts.map(([slug, heading]) => [heading, slug]));
  let slug: string | undefined;
  let figure: number | undefined;
  let inside = false;
  for (const line of source.text.replace(/\r/g, '').split('\n')) {
    const start = headings.get(line);
    if (start !== undefined) slug = start;
    const note = NOTE_LINE.exec(line);
    if (note !== null) {
      notes.set(note[1] ?? '', note[2] ?? '');
      continue;
    }
    if (slug === undefined || line.trim() === '' || line.startsWith('#')) continue;
    // The words inside a figure (one entry for each line) belong to the figure, not to the text.
    if (/^FIGURE \d+ /.test(line)) inside = true;
    if (inside) {
      inside = line.startsWith('- ') || /^FIGURE \d+ /.test(line);
      if (inside) continue;
    }
    const lines = body.get(slug) ?? [];
    body.set(slug, lines);
    const number = FIGURE_LINE.exec(line);
    if (number !== null) {
      figure = Number(number[1]);
      captions.set(figure, { slug, text: line.replace(/^FIGURE: /, '') });
      continue;
    }
    if (line.startsWith(NOTE_OF_FIGURE)) {
      const caption = figure === undefined ? undefined : captions.get(figure);
      // A note with no numbered figure before it closes a map with no number: drop its title.
      if (caption === undefined) lines.pop();
      else caption.text = `${caption.text}. ${line.slice(NOTE_OF_FIGURE.length)}`;
      figure = undefined;
      continue;
    }
    figure = undefined;
    lines.push(line);
  }
  return { body, captions, notes };
}

// The month names of the two locales. A month name is in one language only, so the two lists can
// share one pattern.
const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December|' +
  'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const TOKEN = new RegExp(`\\[\\^([^\\]]+)\\]|\\d+(?:[.,]\\d+)*|\\b(?:${MONTHS})\\b`, 'g');

/** The numbers, the month names and the note markers of a text, in their order. A node mark
 * counts by its words only, so the digits of a node id are not numbers of the text. */
export function tokens(text: string): readonly string[] {
  const words = text.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1');
  return [...words.matchAll(TOKEN)].map((match) =>
    match[1] === undefined ? match[0] : `^${match[1]}`,
  );
}

/** The words of a text with no mark: no note marker, no node id, no bold or italic star, and no
 * list dash of the source (with or without its en dash). */
export const words = (text: string): string =>
  text
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\*/g, '')
    .replace(/(^|\s)- –?/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((one, index) => one === b[index]);

const noteIds = (text: string) =>
  tokens(text).flatMap((one) => (one.startsWith('^') ? [one.slice(1)] : []));

/** Compare the parts with the source text. Each difference is one line; no line means parity:
 * the body has the words of the source and the same numbers, months and note markers in the same
 * order, each figure caption has those of its source caption, the title, period and sources that
 * the frame shows are pieces of that caption, each part holds exactly the notes it cites, with the
 * words of the source, and the parts hold the figures of their source sections. */
export function parity(parts: readonly ReportPart[], source: Source): readonly string[] {
  const read = readSource(source);
  const issues: string[] = [];
  const shown = new Set<number>();
  for (const part of parts) {
    const isFigure = (block: ReportBlock) => block.kind === 'figure';
    const body = part.blocks.filter((block) => !isFigure(block) && block.kind !== 'h3');
    const source = (read.body.get(part.slug) ?? []).join(' ');
    const text = body.map((block) => block.text).join(' ');
    const [want, have] = [tokens(source), tokens(text)];
    if (!sameList(want, have))
      issues.push(`${part.slug}: body ${have.join(' ')} != source ${want.join(' ')}`);
    if (words(source) !== words(text)) issues.push(`${part.slug}: body words differ`);
    for (const block of part.blocks.filter(isFigure)) {
      const number = block.figure?.number ?? 0;
      shown.add(number);
      const caption = read.captions.get(number);
      if (caption === undefined)
        issues.push(`${part.slug}: figure ${String(number)} not in source`);
      else if (
        !sameList(tokens(caption.text), tokens(block.text)) ||
        words(caption.text) !== words(block.text)
      )
        issues.push(`${part.slug}: figure ${String(number)} caption differs`);
      // The frame shows these fields, not the caption: each one is a piece of the caption.
      const { title = '', period = '', sources = '' } = block.figure ?? {};
      if (![title, period, sources].every((field) => block.text.includes(field)))
        issues.push(`${part.slug}: figure ${String(number)} fields differ`);
    }
    const cited = new Set(part.blocks.flatMap((block) => noteIds(block.text)));
    const held = new Set(part.notes.map((note) => note.id));
    for (const id of cited) if (!held.has(id)) issues.push(`${part.slug}: note ${id} missing`);
    for (const note of part.notes) {
      if (!cited.has(note.id)) issues.push(`${part.slug}: note ${note.id} not cited`);
      if (read.notes.get(note.id) !== note.text)
        issues.push(`${part.slug}: note ${note.id} differs`);
    }
  }
  const slugs = new Set(parts.map((part) => part.slug));
  for (const [number, caption] of read.captions)
    if (slugs.has(caption.slug) && !shown.has(number))
      issues.push(`${caption.slug}: figure ${String(number)} not shown`);
  return issues;
}
