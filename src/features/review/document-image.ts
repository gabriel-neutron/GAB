import { useEffect, useState } from 'react';

import { readDocumentBytes } from '@/shared/write/door';

/** The stored image of one document, as the justification draws it: still on its way, shown from
 * a local address, or not given. */
export type DocumentImage =
  | { readonly state: 'loading' }
  | { readonly state: 'shown'; readonly address: string }
  | { readonly state: 'failed' };

// External constraint: the writer gives only these two types, and an img element draws both.
const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg']);

// Two exports and one job: the justification asks for the image only of a type that the hook
// below draws.
/** Whether the writer gives the stored bytes of a document of this type as an image. */
export const isImageType = (mime: string | null): boolean => mime !== null && IMAGE_TYPES.has(mime);

const LOADING: DocumentImage = { state: 'loading' };
const FAILED: DocumentImage = { state: 'failed' };

const load = async (document: string): Promise<Blob | null> => {
  const bytes = await readDocumentBytes(document);
  return bytes !== null && isImageType(bytes.type) ? bytes : null;
};

/** Read the stored image of one document from the writer. The raw store is private, so the
 * bytes come through the writer and live at a local address that dies with the justification. */
export function useDocumentImage(document: string): DocumentImage {
  const [image, setImage] = useState<DocumentImage>(LOADING);

  // An answer that arrives after the justification closed changes nothing, and the local address
  // of the bytes is freed when the justification closes.
  useEffect(() => {
    let live = true;
    let address: string | null = null;
    void load(document).then((bytes) => {
      if (!live) return;
      if (bytes === null) {
        setImage(FAILED);
        return;
      }
      address = URL.createObjectURL(bytes);
      setImage({ state: 'shown', address });
    });
    return () => {
      live = false;
      if (address !== null) URL.revokeObjectURL(address);
    };
  }, [document]);

  return image;
}
