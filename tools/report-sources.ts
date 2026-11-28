// Export the full source list of the report: each reference of the final English text, with its
// section, the sentence that it supports and its entry of the bibliography, as a CSV file and a
// readable Markdown file. The references of section 5 carry a mark.
//
//     node tools/report-sources.ts <output folder>
//
// The output folder is a folder that git ignores, for example research/out/fnf/livraison/.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit } from 'node:process';

// The types of the modules of the page that the tool reads. The tools project does not compile the
// application.
interface Entry {
  readonly key: string;
  readonly group: string;
  readonly cite: string;
  readonly issuer: string;
  readonly date: string;
  readonly title: string;
  readonly url: string;
  readonly detail?: string;
}
interface Line {
  readonly id: string;
  readonly text: string;
}
interface Bibliography {
  readonly GROUPS: Record<string, string>;
  readonly entryOf: (key: string) => Entry;
  readonly splitNote: (text: string) => { cite: string; note: string };
  readonly citeText: (text: string) => string;
  readonly noteText: (text: string) => string;
  readonly citingNotes: (notes: Line[]) => ReadonlyMap<string, string[]>;
  readonly groupedEntries: () => readonly (readonly [string, readonly Entry[]])[];
}
interface Stored {
  readonly id: string;
  readonly retrievedAt: string;
  readonly url: string;
}
interface Documents {
  readonly sourceDocuments: (source: Entry, noteIds: Iterable<string>) => Stored[];
}

// A spreadsheet reads the file as UTF-8 when it starts with this mark.
const BOM = String.fromCharCode(0xfeff);
const SOURCE = resolve(import.meta.dirname, '../src/features/report/source/report-en.md');
/** The part of the report whose references the foundation checks first. */
const MARKED = '## 5 ';

/** One reference of the text: a note call, where it stands, and the sentence around it. */
export interface Call {
  readonly id: string;
  readonly section: string;
  readonly subsection: string;
  readonly sentence: string;
}

/** The words of a text with no mark: no note call, no node id, no bold or italic star. */
const plain = (text: string): string =>
  text
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\*+/g, '')
    .replace(/^- –?/u, '')
    .trim();

/** Each note call of the final text, with its section, its subsection and its sentence. A call
 * in a figure note gives the figure note as its sentence. */
export function callsOf(text: string): Call[] {
  const calls: Call[] = [];
  let section = '';
  let subsection = '';
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('## ')) [section, subsection] = [line.slice(3), ''];
    else if (line.startsWith('### ')) subsection = line.slice(4);
    if (line.startsWith('[^') || line.startsWith('#')) continue;
    for (const match of line.matchAll(/\[\^(\d+)\]/g)) {
      const at = match.index;
      // The sentence runs from the end of the sentence before the call to the next stop.
      const before = line.slice(0, at);
      const start = Math.max(
        0,
        ...[...before.matchAll(/[.!?]["”)]?\s+(?=\S)/g)].map((m) => m.index + m[0].length),
      );
      const after = /[.!?](?=\s|$)/.exec(line.slice(at));
      const end = after === null ? line.length : at + after.index + 1;
      const sentence = plain(line.slice(start, end).replace(/\[\^\d+\]/g, ''));
      calls.push({ id: match[1] ?? '', section, subsection, sentence });
    }
  }
  return calls;
}

const csvCell = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

async function main(): Promise<void> {
  const out = argv[2];
  if (out === undefined) {
    console.error('Usage: node tools/report-sources.ts <output folder>');
    exit(1);
  }
  const { runnerImport } = await import('vite');
  const at = (file: string) => resolve(import.meta.dirname, '../src/features/report', file);
  const bib = (await runnerImport(at('bibliography.ts'))).module as Bibliography;
  const { sourceDocuments } = (await runnerImport(at('note-documents.ts'))).module as Documents;
  const text = readFileSync(SOURCE, 'utf8');
  const lines: Line[] = [...text.matchAll(/^\[\^(\d+)\]: (.*)$/gmu)].map(
    ([, id = '', note = '']) => ({ id, text: note.trim() }),
  );
  const notes = new Map(lines.map((line) => [line.id, line.text]));
  const calls = callsOf(text);

  const head = [
    'note',
    'section_5',
    'section',
    'subsection',
    'sentence',
    'reference_in_text',
    'short_note',
    'entry_key',
    'locator',
    'group',
    'issuer',
    'title',
    'date',
    'address',
    'accessed',
    'stored_copies',
  ];
  const rows: string[][] = [];
  const readable: string[] = [
    '# Full source list of the report',
    '',
    'Each reference of the report text, in the order of the text: the sentence that it supports, the reference as the text gives it, and the full entry of each source that it cites. The references of section 5 have the mark **[section 5]**. "Stored copies" are the identifiers of the documents that the record holds (the SHA-256 hash of each file); the record holds no web archive copy.',
    '',
  ];
  let section = '';
  for (const call of calls) {
    const note = notes.get(call.id);
    if (note === undefined) throw new Error(`note ${call.id} has no note line`);
    const { cite } = bib.splitNote(note);
    const short = bib.noteText(note);
    const marked = `## ${call.section}`.startsWith(MARKED);
    if (call.section !== section) {
      section = call.section;
      readable.push(`## ${section}`, '');
    }
    readable.push(
      `### Note ${call.id}${marked ? ' [section 5]' : ''}${call.subsection === '' ? '' : ` (${call.subsection})`}`,
      '',
      `> ${call.sentence}`,
      '',
      `Reference in the text: (${bib.citeText(note)})`,
      '',
    );
    if (short !== '') readable.push(`Short note: ${short}`, '');
    // Each part of the reference: an entry, and the words that follow it up to the next entry.
    for (const part of cite.split(/(?=@)/)) {
      const key = /^@([a-z0-9][a-z0-9-]*)/.exec(part)?.[1];
      if (key === undefined) continue;
      const entry = bib.entryOf(key);
      const locator = part
        .slice(key.length + 1)
        .replace(/^[,;\s]+|[;\s]+$/g, '')
        .replace(/;?\s*authors' calculations based on$/u, '');
      const stored = sourceDocuments(entry, [call.id]);
      const accessed = stored
        .map((one) => one.retrievedAt)
        .sort()
        .at(-1);
      rows.push([
        call.id,
        marked ? 'yes' : '',
        call.section,
        call.subsection,
        call.sentence,
        `(${bib.citeText(note)})`,
        short,
        key,
        locator,
        bib.GROUPS[entry.group] ?? entry.group,
        entry.issuer,
        entry.title,
        entry.date,
        entry.url,
        accessed ?? '',
        stored.map((one) => `${one.id} ${one.retrievedAt} ${one.url}`).join(' | '),
      ]);
      readable.push(
        `- **${entry.cite}**${locator === '' ? '' : `, ${locator}`}. ${entry.issuer} (${entry.date}). *${entry.title}*.${entry.detail === undefined ? '' : ` ${entry.detail}.`} <${entry.url}>`,
      );
      if (accessed !== undefined)
        readable.push(
          `  - Accessed ${accessed}. Stored copies: ${stored.map((one) => `${one.id} (${one.retrievedAt})`).join(', ')}`,
        );
    }
    readable.push('');
  }
  const citing = bib.citingNotes(lines);
  readable.push('## Bibliography', '');
  for (const [group, entries] of bib.groupedEntries()) {
    readable.push(`### ${bib.GROUPS[group] ?? group}`, '');
    for (const entry of entries)
      readable.push(
        `- **${entry.cite}**. ${entry.issuer} (${entry.date}). *${entry.title}*.${entry.detail === undefined ? '' : ` ${entry.detail}.`} <${entry.url}> Notes: ${(citing.get(entry.key) ?? []).join(', ')}.`,
      );
    readable.push('');
  }
  mkdirSync(out, { recursive: true });
  const csv = [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  writeFileSync(join(out, 'report-sources.csv'), `${BOM}${csv}\n`);
  writeFileSync(join(out, 'report-sources.md'), `${readable.join('\n')}\n`);
  const entries = bib.groupedEntries().reduce((sum, [, group]) => sum + group.length, 0);
  console.log(
    `${String(calls.length)} calls, ${String(rows.length)} rows, ${String(rows.filter((row) => row[1] === 'yes').length)} rows of section 5, ${String(entries)} entries`,
  );
}

if (import.meta.main) await main();
