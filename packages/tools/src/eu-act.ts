import { extractText, UnsupportedTypeError } from '@gab/text';
import { z } from 'zod';

import { checkedRange, documentText, nextShape } from './document-text.ts';
import { htmlTitle, MAX_BYTES } from './fetch-document.ts';
import { FetchRefusal, guardedGet } from './fetch-guard.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// External constraint: the Cellar of the Publications Office gives an act by its CELEX number and
// picks the format and the language from the Accept headers. It answers 303 to the address of the
// file. The tool sends the user agent of the project and nothing else, and it never asks again
// after a refusal.
export const CELLAR = 'https://publications.europa.eu/resource/celex/';
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const MAX_TITLE = 500;

const FORMATS = {
  xhtml: 'application/xhtml+xml',
  pdf: 'application/pdf',
} as const;

// A CELEX number: the sector, the year, the type of the act and its number, with the date of a
// consolidated text after a hyphen.
const CELEX = /^[0-9CE][0-9]{4}[A-Z]{1,2}[0-9A-Z()]{1,12}(?:-[0-9]{8})?$/u;

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  celex: z.string(),
  language: z.string(),
  mime: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
  pages: z.array(z.strictObject({ page: z.number().int().min(1), text: z.string() })),
  lastPage: z.number().int().nullable(),
  truncated: z.boolean(),
  next: nextShape,
});

const typeOf = (contentType: string | null): string =>
  (contentType?.split(';')[0] ?? '').trim().toLowerCase();

/** The tool on one address of the Cellar. A test gives the address of a local server. */
export const euActAt = (cellar: string) =>
  defineTool({
    name: 'eu_act',
    description:
      'Reads the official text of one act of the Official Journal of the European Union from ' +
      'its CELEX number (for example 32014R0833, or 02014R0833-20240625 for a consolidated ' +
      'text). It asks the Cellar of the Publications Office for the format and the language, ' +
      'stores the file as a document with its official address, and returns the document id ' +
      'and the text of its pages, as fetch_document does. Cite that document id. The language ' +
      'is a three-letter code (eng, fra, deu). A refusal of the publisher is reported, and the ' +
      'tool does not try again.',
    input: z.strictObject({
      celex: z.string().trim().toUpperCase().regex(CELEX, 'a CELEX number such as 32014R0833'),
      language: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z]{3}$/u, 'a three-letter code such as eng')
        .default('eng'),
      format: z.enum(['xhtml', 'pdf']).default('xhtml'),
      fromPage: z.number().int().min(1).default(1),
      toPage: z.number().int().min(1).optional(),
    }),
    output: outputShape,
    async run(session, input, reach) {
      if (reach?.store === undefined)
        throw new ToolRefusal('this surface gives no object store, so it stores no act');
      const toPage = checkedRange(input.fromPage, input.toPage);
      const asked = FORMATS[input.format];

      let got;
      try {
        got = await guardedGet(`${cellar}${encodeURIComponent(input.celex)}`, {
          maxBytes: MAX_BYTES,
          timeoutMs: reach.fetchTimeoutMs ?? TIMEOUT_MS,
          maxRedirects: MAX_REDIRECTS,
          ask: { accept: asked, 'accept-language': input.language },
          ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
          ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
        });
      } catch (fault) {
        if (fault instanceof FetchRefusal)
          throw new ToolRefusal(
            `the Publications Office gave no act ${input.celex} in ${input.format} and ` +
              `${input.language}: ${fault.message}. The tool does not ask again`,
          );
        throw fault;
      }

      const mime = typeOf(got.contentType);
      if (mime !== asked)
        throw new ToolRefusal(
          `the Publications Office gave ${mime === '' ? 'no type' : mime} and not ${asked}, ` +
            'so nothing is stored',
        );
      let pages: readonly string[];
      try {
        ({ pages } = await extractText(got.bytes, got.contentType ?? mime));
      } catch (fault) {
        if (fault instanceof UnsupportedTypeError)
          throw new ToolRefusal(`no text is read from the answer of type ${mime}`);
        throw fault;
      }
      if (pages.join('').trim() === '')
        throw new ToolRefusal(`the act ${input.celex} holds no text, so nothing is stored`);

      const named = mime === FORMATS.xhtml ? htmlTitle(got.bytes, got.contentType ?? mime) : null;
      const title = `${named ?? 'Act'} (CELEX ${input.celex}, ${input.language})`.slice(
        0,
        MAX_TITLE,
      );
      const day = reach.now().toISOString().slice(0, 10);
      const stored = await storeAnswer(session, reach.store, {
        kind: 'url',
        bytes: got.bytes,
        mime,
        uri: got.url,
        title,
        pages,
        day,
      });
      const text = await documentText.run(session, {
        document: stored.id,
        fromPage: input.fromPage,
        fromCharacter: 0,
        toPage,
      });
      return {
        document: stored.id,
        status: stored.status,
        title: stored.title,
        celex: input.celex,
        language: input.language,
        mime,
        url: got.url,
        retrievedAt: stored.retrieved_at ?? day,
        pages: text.pages,
        lastPage: text.lastPage,
        truncated: text.truncated,
        next: text.next,
      };
    },
  });

export const euAct = euActAt(CELLAR);
