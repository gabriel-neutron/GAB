/** The boxes of the upload, read into one request or into one sentence. The writer is the second
 * tier and refuses what this misses; this tier gives a sentence before a file crosses the wire. */

import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';

/** What the analyst has chosen and typed. A blank box is the untouched state. */
export interface UploadForm {
  readonly file: File | null;
  readonly title: string;
  readonly uri: string;
  readonly retrievedAt: string;
  /** The id of a provider, or blank for none. */
  readonly providerId: string;
  readonly cost: string;
}

/** The fields the request will carry beside the file. */
export interface UploadFields {
  readonly title: string;
  readonly retrievedAt: string;
  readonly uri: string | null;
  readonly providerId: string | null;
  readonly costEur: number | null;
}

export type UploadDraft =
  | { readonly ready: true; readonly file: File; readonly fields: UploadFields }
  | { readonly ready: false; readonly reason: string };

export const BLANK_UPLOAD: UploadForm = {
  file: null,
  title: '',
  uri: '',
  retrievedAt: '',
  providerId: '',
  cost: '',
};

const MEBIBYTE = 1024 * 1024;

const NO_FILE = 'Choose the file to upload.';
const EMPTY_FILE = 'The file holds no byte, and the writer does not take it.';
const TOO_LARGE = `The file is larger than ${String(UPLOAD_FILE_BYTES / MEBIBYTE)} MiB, and the writer does not take it.`;
const NO_TITLE = 'Write the title of the document.';
const NO_DAY = 'Write the day the file was retrieved. The record takes no document without it.';
const NOT_WEB = 'The purchase page is an http or an https address.';
const NOT_COST = 'Write the cost in euros, as a number with at most two decimals.';

const WEB_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);
const EUROS = /^\d{1,10}(\.\d{1,2})?$/u;

/** The title a chosen file proposes: its name, which the analyst may write over. */
export const titleOf = (file: File): string => file.name;

/** One form, read into the request it carries. A box of spaces alone is a blank box. */
export function readUploadDraft(form: UploadForm): UploadDraft {
  if (form.file === null) return { ready: false, reason: NO_FILE };
  if (form.file.size === 0) return { ready: false, reason: EMPTY_FILE };
  if (form.file.size > UPLOAD_FILE_BYTES) return { ready: false, reason: TOO_LARGE };

  const title = form.title.trim();
  if (title === '') return { ready: false, reason: NO_TITLE };

  const retrievedAt = form.retrievedAt.trim();
  if (retrievedAt === '') return { ready: false, reason: NO_DAY };

  const uri = form.uri.trim();
  if (uri !== '' && !WEB_SCHEMES.has(URL.parse(uri)?.protocol ?? ''))
    return { ready: false, reason: NOT_WEB };

  const cost = form.cost.trim();
  if (cost !== '' && !EUROS.test(cost)) return { ready: false, reason: NOT_COST };

  return {
    ready: true,
    file: form.file,
    fields: {
      title,
      retrievedAt,
      uri: uri === '' ? null : uri,
      providerId: form.providerId === '' ? null : form.providerId,
      costEur: cost === '' ? null : Number(cost),
    },
  };
}
