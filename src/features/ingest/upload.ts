/** One file on the screen, one document in the record. This file holds the states the upload
 * passes through and the sentence each one reads. */

import type { Said } from '@/shared/said';
import { uploadDocument, type UploadBody, type Uploaded } from '@/shared/write/door';
import { writeSaid, type WriteResult, type WriteState } from '@/shared/write/write-state';

import type { UploadDraft, UploadFields } from './upload-draft';

export type UploadState = WriteState<Uploaded>;

// A document with no provider carries no licence, so the release rule holds it back.
const READY_INTERNAL = 'Ready to upload. With no provider, the document stays internal.';
const READY = 'Ready to upload.';

// The request left the browser and no answer came back. The same bytes are never stored twice,
// so the analyst may send the file again.
const UNSURE =
  'It is not known whether the file was stored. Send it again: the same file is never stored twice.';

// No page is read from an image, so a scan is stored with no text, and the pages are named.
const storedWords = (documentId: string, emptyPages: readonly number[]): string => {
  const stored = `The file is stored as document ${documentId}.`;
  if (emptyPages.length === 0) return stored;
  const pages = emptyPages.length === 1 ? 'Page' : 'Pages';
  return `${stored} ${pages} ${emptyPages.join(', ')} hold no text that can be read.`;
};

const idleWords = (draft: UploadDraft): string => {
  if (!draft.ready) return draft.reason;
  return draft.fields.providerId === null ? READY_INTERNAL : READY;
};

/** The one sentence the dialog reads, and whether it interrupts. */
export function uploadSaid(state: UploadState, draft: UploadDraft): Said {
  return writeSaid<Uploaded, object>(state, {
    idle: idleWords(draft),
    working: () => 'The file is going to the record.',
    done: (done) =>
      done.document === 'stored'
        ? storedWords(done.documentId, done.emptyPages)
        : `The file is already in the record as document ${done.documentId}. Nothing was written.`,
    unknown: () => UNSURE,
  });
}

// Origin of the number: a spread of more arguments than this can pass the call stack of a
// browser, so the bytes are turned into text in slices.
const SLICE = 0x8000;

const base64Of = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  for (let at = 0; at < bytes.length; at += SLICE)
    text += String.fromCharCode(...bytes.subarray(at, at + SLICE));
  return btoa(text);
};

const bodyOf = (file: File, content: string, fields: UploadFields): UploadBody => ({
  fileName: file.name,
  content,
  title: fields.title,
  retrievedAt: fields.retrievedAt,
  ...(fields.uri === null ? {} : { uri: fields.uri }),
  ...(fields.providerId === null ? {} : { providerId: fields.providerId }),
  ...(fields.costEur === null ? {} : { costEur: fields.costEur }),
});

const UNREAD = 'the browser could not read the file, and nothing was sent';

/** Read the file, send it, and answer with the result the dialog stands in. It raises nothing. */
export async function sendUpload(file: File, fields: UploadFields): Promise<WriteResult<Uploaded>> {
  let content: string;
  try {
    content = await base64Of(file);
  } catch {
    return { step: 'refused', refusal: UNREAD };
  }
  return uploadDocument(bodyOf(file, content, fields));
}
