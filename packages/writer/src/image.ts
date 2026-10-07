import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type Unwritten } from './statement.ts';

/** The one thing the image door reaches outside the database: the raw store, read with the
 * account that may only read. */
export interface ObjectReader {
  read(key: string): Promise<Uint8Array<ArrayBuffer>>;
}

/** The bytes of one stored image, and the type its row records. */
interface StoredImage {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly mime: string;
}

type ImageRead = { readonly outcome: 'done'; readonly image: StoredImage } | Unwritten;

// External constraint: a browser draws these two types in an img element, and OCR reads them.
// Every other stored type stays text, or a file the operator opens in another tool.
const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg']);

const asked = z.strictObject({ document: z.string().trim().min(1) });

const row = z.object({ mime: z.string().nullable(), s3_key: z.string().nullable() });

const STORED = 'SELECT mime, s3_key FROM public.documents WHERE id = $1';

const NO_DOCUMENT = 'the record holds no document of that id';
const NOT_IMAGE = 'the document is not a png or a jpeg image';
const NOT_GIVEN = 'the raw store did not give the image';

/** The bytes of one stored png or jpeg document, read as the operator. The raw store is private,
 * so an image reaches the review page through the writer and never through the public read. */
export const readDocumentImage = async (
  pool: Sessions,
  reader: ObjectReader,
  raw: string,
): Promise<ImageRead> => {
  const given = readBody(raw, asked, 'the body names one document by its id');
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, STORED, [given.body.document]);
  if (answer.outcome !== 'answered') return answer;

  const [first] = answer.rows;
  if (first === undefined) return refused(NO_DOCUMENT);
  const stored = row.parse(first);
  if (stored.mime === null || !IMAGE_TYPES.has(stored.mime) || stored.s3_key === null)
    return refused(NOT_IMAGE);

  try {
    return {
      outcome: 'done',
      image: { bytes: await reader.read(stored.s3_key), mime: stored.mime },
    };
  } catch (cause) {
    console.error('the image did not come from the raw store', { cause });
    return { outcome: 'unavailable', reply: { refusal: NOT_GIVEN } };
  }
};
