/** One file on the screen, one document in the record. This file holds the states the upload
 * passes through and the sentence each one reads. */

import { calm, interrupt, type Said } from '@/shared/said';
import { uploadDocument, type UploadBody } from '@/shared/write/door';

import type { UploadDraft, UploadFields } from './upload-draft';

export type UploadState =
  | { readonly step: 'idle' }
  | { readonly step: 'working' }
  | {
      readonly step: 'stored';
      readonly documentId: string;
      readonly emptyPages: readonly number[];
    }
  | { readonly step: 'known'; readonly documentId: string }
  | { readonly step: 'refused'; readonly refusal: string }
  | { readonly step: 'unknown'; readonly doubt: string };

const WORKING = 'The file is going to the record.';

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

/** The one sentence the dialog reads, and whether it interrupts. */
export function uploadSaid(state: UploadState, draft: UploadDraft): Said {
  switch (state.step) {
    case 'working':
      return calm(WORKING);
    case 'stored':
      return calm(storedWords(state.documentId, state.emptyPages));
    case 'known':
      return calm(
        `The file is already in the record as document ${state.documentId}. Nothing was written.`,
      );
    case 'refused':
      return calm(`No document was stored: ${state.refusal}.`);
    case 'unknown':
      return interrupt(`${UNSURE} ${state.doubt}`);
    case 'idle':
      if (!draft.ready) return calm(draft.reason);
      return calm(draft.fields.providerId === null ? READY_INTERNAL : READY);
  }
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

/** Read the file, send it, and answer with the state the dialog stands in. It raises nothing. */
export async function sendUpload(file: File, fields: UploadFields): Promise<UploadState> {
  let content: string;
  try {
    content = await base64Of(file);
  } catch {
    return { step: 'refused', refusal: UNREAD };
  }
  const outcome = await uploadDocument(bodyOf(file, content, fields));
  switch (outcome.state) {
    case 'stored':
      return { step: 'stored', documentId: outcome.documentId, emptyPages: outcome.emptyPages };
    case 'known':
      return { step: 'known', documentId: outcome.documentId };
    case 'refused':
      return { step: 'refused', refusal: outcome.refusal };
    case 'unknown':
      return { step: 'unknown', doubt: outcome.doubt };
  }
}
