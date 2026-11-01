// Builds the note-to-documents file of the web report from the record (ADR 0033).
//
//   node tools/note-documents.ts <final English text (Markdown)>
//
// It reads the notes `[^N]: ...` of the text, and asks the document tools of the MCP server on
// this PC (`pnpm mcp:serve`) for each address of each note. A row comes from an exact address (a
// fragment is removed first) or from a row of the reviewed manual table. An address that is only a
// host gives no row. It checks the file, writes it beside the report data, and prints the match
// rate. A fault stops the command before the write.

import { readFileSync, writeFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

import { z } from 'zod';

import {
  noteDocumentFaults,
  type NoteDocument,
  type NoteDocumentsFile,
} from '../src/features/report/note-documents.ts';

const MCP = 'http://127.0.0.1:7420/mcp';
const DATA = new URL('../src/features/report/data/', import.meta.url);

const storedDocument = z.object({
  id: z.string(),
  type: z.string(),
  url: z.string().nullable(),
  retrievedAt: z.string().nullable(),
});
type StoredDocument = z.infer<typeof storedDocument>;
const manualTable = z.array(
  z.object({ note: z.number().int().positive(), url: z.url(), reason: z.string().min(1) }),
);
const rpcAnswer = z.object({
  result: z.object({ content: z.array(z.object({ text: z.string() })).optional() }).optional(),
  error: z.unknown().optional(),
});

let session: string | null = null;
let next = 1;
const rpc = async (method: string, params: unknown) => {
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
  const body = rpcAnswer.parse(JSON.parse(data === undefined ? text : data.slice(6)));
  if (body.error !== undefined) throw new Error(JSON.stringify(body.error));
  return body.result;
};

const findDocuments = async (url: string): Promise<StoredDocument[]> => {
  const result = await rpc('tools/call', { name: 'find_document', arguments: { url } });
  const text = result?.content?.[0]?.text;
  if (text === undefined) throw new Error(`find_document gave no answer for ${url}`);
  return z.object({ documents: z.array(storedDocument) }).parse(JSON.parse(text)).documents;
};

const withoutFragment = (url: string): string => url.split('#')[0] ?? url;
const isHostOnly = (url: string): boolean => {
  const parsed = new URL(url);
  return (parsed.pathname === '/' || parsed.pathname === '') && parsed.search === '';
};
const addressesOf = (note: string): string[] =>
  [...note.matchAll(/https?:\/\/[^\s;]+/gu)].map((match) => {
    let url = match[0].replace(/[.,*\]>'"”]+$/u, '');
    // A note closes a bracket after an address; an address keeps a bracket that it opens.
    while (url.endsWith(')') && url.split('(').length < url.split(')').length)
      url = url.slice(0, -1);
    return url.replace(/[.,*\]>'"”]+$/u, '');
  });

const source = argv[2];
if (source === undefined) {
  console.error('Usage: node tools/note-documents.ts <final English text (Markdown)>');
  exit(1);
}
const notes = [...readFileSync(source, 'utf8').matchAll(/^\[\^(\d+)\]: (.*)$/gmu)].map(
  ([, id = '', text = '']) => ({ id, text }),
);
const manual = manualTable.parse(
  JSON.parse(readFileSync(new URL('note-documents-manual.json', DATA), 'utf8')),
);

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
const row = (document: StoredDocument, match: 'exact' | 'manual'): NoteDocument => {
  if (document.url === null || document.retrievedAt === null)
    throw new Error(`${document.id} has no address or no retrieval day`);
  const { id, type, retrievedAt, url } = document;
  return { id, type, retrievedAt, url, match };
};

const file: NoteDocumentsFile = { builtOn: new Date().toISOString().slice(0, 10), notes: [] };
let exactNotes = 0;
for (const note of notes) {
  const documents: NoteDocument[] = [];
  const add = (document: StoredDocument, match: 'exact' | 'manual') => {
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

const noteIds = new Set(notes.map((note) => note.id));
const unknown = manual.filter((held) => !noteIds.has(String(held.note)));
const faults = [
  ...noteDocumentFaults(file, noteIds),
  ...unknown.map((held) => `manual row of note ${held.note}: unknown note id`),
];
if (faults.length > 0) {
  console.error(faults.join('\n'));
  exit(1);
}
writeFileSync(new URL('note-documents.json', DATA), JSON.stringify(file, null, 2) + '\n');
const linked = file.notes.filter((note) => note.documents.length > 0).length;
const percent = (count: number) => ((100 * count) / notes.length).toFixed(1);
console.log(`${notes.length} notes; exact: ${exactNotes} (${percent(exactNotes)} %)`);
console.log(`with the manual table: ${linked} (${percent(linked)} %)`);
