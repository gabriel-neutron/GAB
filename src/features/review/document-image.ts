import { useEffect, useState } from 'react';

/** The stored image of one document, as the card draws it: still on its way, shown from a local
 * address, or not given. */
export type DocumentImage =
  | { readonly state: 'loading' }
  | { readonly state: 'shown'; readonly address: string }
  | { readonly state: 'failed' };

const DOOR = '/private/document-image';

// External constraint: the writer gives only these two types, and an img element draws both.
const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg']);

// Two exports and one job: the card asks for the image of a type that the read below accepts.
/** Whether the writer gives the stored bytes of a document of this type as an image. */
export const isImageType = (mime: string | null): boolean => mime !== null && IMAGE_TYPES.has(mime);

const LOADING: DocumentImage = { state: 'loading' };
const FAILED: DocumentImage = { state: 'failed' };

// The development server proxies the address to the writer, so the browser stays same-origin.
const load = async (document: string): Promise<Blob | null> => {
  try {
    const answer = await fetch(DOOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document }),
    });
    if (!answer.ok) return null;
    const bytes = await answer.blob();
    return isImageType(bytes.type) ? bytes : null;
  } catch {
    return null;
  }
};

/** Read the stored image of one document from the writer. The raw store is private, so the
 * bytes come through the writer and live at a local address that dies with the card. */
export function useDocumentImage(document: string): DocumentImage {
  const [image, setImage] = useState<DocumentImage>(LOADING);

  // An answer that arrives after the card closed changes nothing, and the local address of the
  // bytes is freed when the card closes.
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
