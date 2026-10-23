import { z } from 'zod';

import { hostOf } from './document-type.ts';
import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const MAX_DOCUMENTS = 20;

// A percent sign and an underscore are letters in an address, and a backslash escapes them.
const escaped = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

// The exact address comes first, then the newest document.
const FIND = `SELECT d.id::text AS id, d.title, d.uri, d.kind, d.doc_type, d.mime,
         d.retrieved_at::text AS retrieved_at,
         (SELECT max(t.page) FROM public.document_text t WHERE t.document_id = d.id)::int
           AS text_pages,
         (SELECT p.archive_id FROM public.documents p WHERE p.id = d.id) AS archive_id,
         (SELECT p.archive_path FROM public.documents p WHERE p.id = d.id) AS archive_path
    FROM api.document d
   WHERE ($1::text IS NULL OR d.uri ILIKE '%' || $1::text || '%' ESCAPE '\\')
     AND ($2::text IS NULL OR d.title ILIKE '%' || $2::text || '%' ESCAPE '\\')
   ORDER BY COALESCE(d.uri = $3::text, false) DESC, d.created_at DESC, d.id
   LIMIT $4::int`;

const row = z.strictObject({
  id: z.string(),
  title: z.string(),
  uri: z.string().nullable(),
  kind: z.string(),
  doc_type: z.string(),
  mime: z.string().nullable(),
  retrieved_at: z.string().nullable(),
  text_pages: z.number().int().nullable(),
  archive_id: z.string().nullable(),
  archive_path: z.string().nullable(),
});

export const findDocument = defineTool({
  name: 'find_document',
  description:
    'Finds the stored documents whose address or title holds the text you give. An exact ' +
    'address comes first. Call it before fetch_document, so you do not fetch a page that ' +
    'Gabriel already holds. "type" is legal_act, register_entry, press_release, report, official_publication, ' +
    'reference, company_publication, telegram_post, ngo_publication, news_article or other, ' +
    'and "host" is the host of the address. "textPages" is the number of pages of stored text, and null means ' +
    'that the document has no text to read or to cite. "archive" names the zip archive that ' +
    'held a file, and the path of the file in it.',
  input: z
    .strictObject({
      url: z.string().trim().min(1).max(2048).optional().describe('the address, or a part of it'),
      title: z.string().trim().min(1).max(300).optional().describe('words of the title'),
    })
    .refine((input) => input.url !== undefined || input.title !== undefined, {
      error: 'give a url, a title, or both',
    }),
  output: z.strictObject({
    documents: z.array(
      z.strictObject({
        id: z.string(),
        title: z.string(),
        url: z.string().nullable(),
        kind: z.string(),
        type: z.string(),
        host: z.string().nullable(),
        mime: z.string().nullable(),
        retrievedAt: z.string().nullable(),
        textPages: z.number().int().nullable(),
        archive: z.strictObject({ document: z.string(), path: z.string() }).nullable(),
      }),
    ),
  }),
  async run(session, input) {
    const found = await rowsOf(session, row, FIND, [
      input.url === undefined ? null : escaped(input.url),
      input.title === undefined ? null : escaped(input.title),
      input.url ?? null,
      MAX_DOCUMENTS,
    ]);
    return {
      documents: found.map((held) => ({
        id: held.id,
        title: held.title,
        url: held.uri,
        kind: held.kind,
        type: held.doc_type,
        host: hostOf(held.uri),
        mime: held.mime,
        retrievedAt: held.retrieved_at,
        textPages: held.text_pages,
        archive:
          held.archive_id === null || held.archive_path === null
            ? null
            : { document: held.archive_id, path: held.archive_path },
      })),
    };
  },
});
