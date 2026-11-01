// The note-to-documents file of the report: for each note, the documents of the record that
// support it, and at most one short quote.

export interface NoteDocument {
  readonly id: string;
  readonly type: string;
  readonly retrievedAt: string;
  /** The original address of the document. Never an address of the private store. */
  readonly url: string;
  /** "exact": the note gives this address. "manual": a row of the reviewed manual table. */
  readonly match: string;
}

export interface NoteQuote {
  readonly text: string;
  /** The id of a document of the note. */
  readonly document: string;
  /** The excerpt of a decided fact of the record, as stored. The quote is a part of it. */
  readonly excerpt: string;
  /** The licence of the provider of the document. */
  readonly licence: string;
}

export interface NoteDocumentsFile {
  readonly builtOn: string;
  readonly notes: { readonly id: string; documents: NoteDocument[]; quote?: NoteQuote }[];
}

export const MAX_QUOTE_WORDS = 25;

// The licences that let the public read show a source. A copy of the allow-list of the database
// and of the release, because a feature reads neither: a change there must also change this list.
export const OPEN_LICENCES: ReadonlySet<string> = new Set([
  'public-domain',
  'eu-reuse',
  'ogl-v3',
  'cc0',
  'cc-by-4.0',
  'copernicus',
  'own',
]);

const DOCUMENT_ID = /^doc_[0-9a-f]{12}$/u;
const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const ROW_FIELDS = 'id,match,retrievedAt,type,url';

/** Each fault of the file against the note ids of the report text. An empty list is a pass. */
export function noteDocumentFaults(
  file: NoteDocumentsFile,
  noteIds: ReadonlySet<string>,
): string[] {
  const faults: string[] = [];
  if (!DAY.test(file.builtOn)) faults.push(`builtOn ${file.builtOn} is not a day`);
  const seen = new Set<string>();
  for (const note of file.notes) {
    const at = `note ${note.id}`;
    if (!noteIds.has(note.id)) faults.push(`${at}: unknown note id`);
    if (seen.has(note.id)) faults.push(`${at}: twice in the file`);
    seen.add(note.id);
    for (const document of note.documents) {
      // Only these fields: the original address is the one address that the file can give.
      if (Object.keys(document).sort().join() !== ROW_FIELDS)
        faults.push(`${at}: ${document.id} has other fields than ${ROW_FIELDS}`);
      if (document.match !== 'exact' && document.match !== 'manual')
        faults.push(`${at}: ${document.id} has no known match`);
      if (!DOCUMENT_ID.test(document.id)) faults.push(`${at}: bad document id ${document.id}`);
      if (!DAY.test(document.retrievedAt))
        faults.push(`${at}: ${document.id} has no retrieval day`);
      if (!/^https?:\/\//u.test(document.url))
        faults.push(`${at}: ${document.id} has no original address`);
    }
    const quote = note.quote;
    if (quote === undefined) continue;
    if (quote.text.trim().split(/\s+/u).length > MAX_QUOTE_WORDS)
      faults.push(`${at}: quote over ${MAX_QUOTE_WORDS} words`);
    if (quote.text.trim() === '' || !quote.excerpt.includes(quote.text))
      faults.push(`${at}: quote not in the stored excerpt`);
    if (!OPEN_LICENCES.has(quote.licence)) faults.push(`${at}: quote with no open licence`);
    if (!note.documents.some((document) => document.id === quote.document))
      faults.push(`${at}: quote from a document that the note does not list`);
  }
  for (const id of noteIds) if (!seen.has(id)) faults.push(`note ${id}: not in the file`);
  return faults;
}
