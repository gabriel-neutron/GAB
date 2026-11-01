// Builds the note-to-documents file of the web report from the record (ADR 0033).
//
//   node tools/note-documents.ts <final English text (Markdown)>
//
// It reads the notes `[^N]: ...` of the text, and asks the document tools of the MCP server on
// this PC (`pnpm mcp:serve`) for each address of each note. A row comes from an exact address (a
// fragment is removed first) or from a row of the reviewed manual table. An address that is only a
// host gives no row. It writes the dated file beside the report data, and prints the match rate.

import { readFileSync, writeFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

import type { NoteDocument, NoteDocumentsFile } from '../src/features/report/note-documents.ts';

const MCP = 'http://127.0.0.1:7420/mcp';
const DATA = new URL('../src/features/report/data/', import.meta.url);

interface StoredDocument {
  readonly id: string;
  readonly type: string;
  readonly url: string | null;
  readonly retrievedAt: string | null;
}
interface ManualRow {
  readonly note: number;
  readonly url: string;
  readonly reason: string;
}

let session: string | null = null;
let next = 1;
const rpc = async (method: string, params: unknown): Promise<unknown> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (session !== null) headers['mcp-session-id'] = session;
  const id = next++;
  const answer = await fetch(MCP, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  session = answer.headers.get('mcp-session-id') ?? session;
  const text = await answer.text();
  // External constraint: the server answers a request as one server-sent event.
  const data = text.split('\n').find((line) => line.startsWith('data: '));
  const body = JSON.parse(data === undefined ? text : data.slice(6)) as {
    result?: { content?: { text: string }[] };
    error?: unknown;
  };
  if (body.error !== undefined) throw new Error(JSON.stringify(body.error));
  return body.result;
};

const findDocuments = async (url: string): Promise<StoredDocument[]> => {
  const result = (await rpc('tools/call', { name: 'find_document', arguments: { url } })) as {
    content: { text: string }[];
  };
  const text = result.content[0]?.text ?? '{}';
  return (JSON.parse(text) as { documents?: StoredDocument[] }).documents ?? [];
};

const withoutFragment = (url: string): string => url.split('#')[0] ?? url;
const isHostOnly = (url: string): boolean => {
  const parsed = new URL(url);
  return (parsed.pathname === '/' || parsed.pathname === '') && parsed.search === '';
};
const addressesOf = (note: string): string[] =>
  [...note.matchAll(/https?:\/\/[^\s;]+/gu)].map((match) => {
    let url = match[0].replace(/[.,]+$/u, '');
    // A note closes a bracket after an address; an address keeps a bracket that it opens.
    while (url.endsWith(')') && url.split('(').length < url.split(')').length)
      url = url.slice(0, -1);
    return url.replace(/[.,]+$/u, '');
  });

const source = argv[2];
if (source === undefined) {
  console.error('Usage: node tools/note-documents.ts <final English text (Markdown)>');
  exit(1);
}
const notes = [...readFileSync(source, 'utf8').matchAll(/^\[\^(\d+)\]: (.*)$/gmu)].map(
  ([, id = '', text = '']) => ({ id, text }),
);
const manual = JSON.parse(
  readFileSync(new URL('note-documents-manual.json', DATA), 'utf8'),
) as ManualRow[];

await rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'note-documents', version: '1' },
});

const found = new Map<string, StoredDocument[]>();
const exactly = async (url: string): Promise<StoredDocument[]> => {
  const key = withoutFragment(url);
  if (!found.has(key)) found.set(key, await findDocuments(key));
  return (found.get(key) ?? []).filter(
    (document) => document.url !== null && withoutFragment(document.url) === key,
  );
};
const row = (document: StoredDocument, match: NoteDocument['match']): NoteDocument => ({
  id: document.id,
  type: document.type,
  retrievedAt: document.retrievedAt ?? '',
  url: document.url ?? '',
  match,
});

const file: NoteDocumentsFile = { builtOn: new Date().toISOString().slice(0, 10), notes: [] };
let exactNotes = 0;
for (const note of notes) {
  const documents: NoteDocument[] = [];
  const add = (document: StoredDocument, match: NoteDocument['match']) => {
    if (!documents.some((held) => held.id === document.id)) documents.push(row(document, match));
  };
  for (const url of new Set(addressesOf(note.text)))
    if (!isHostOnly(url)) for (const document of await exactly(url)) add(document, 'exact');
  if (documents.length > 0) exactNotes++;
  for (const manualRow of manual.filter((held) => String(held.note) === note.id)) {
    const stored = await exactly(manualRow.url);
    if (stored.length === 0) throw new Error(`note ${note.id}: no document at ${manualRow.url}`);
    for (const document of stored) add(document, 'manual');
  }
  file.notes.push({ id: note.id, documents });
}

writeFileSync(new URL('note-documents.json', DATA), JSON.stringify(file, null, 2) + '\n');
const linked = file.notes.filter((note) => note.documents.length > 0).length;
const percent = (count: number) => ((100 * count) / notes.length).toFixed(1);
console.log(`${notes.length} notes; exact: ${exactNotes} (${percent(exactNotes)} %)`);
console.log(`with the manual table: ${linked} (${percent(linked)} %)`);
