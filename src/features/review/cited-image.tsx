import { cn } from '@/shared/lib/utils';

import { useDocumentImage } from './document-image';

export interface CitedImageProps {
  readonly document: string;
  readonly title: string;
}

const FOCUS =
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** The stored image of a cited document, beside the words that OCR read from it. The operator
 * compares the two before a decision, because OCR can misread a character. */
export function CitedImage({ document, title }: CitedImageProps) {
  const image = useDocumentImage(document);

  if (image.state === 'failed')
    return (
      <p data-image="failed" className="w-24 shrink-0 text-small/4 text-label">
        The stored image did not load.
      </p>
    );
  if (image.state === 'loading')
    return <span data-image="loading" className="size-24 shrink-0 border border-border" />;

  return (
    <a
      href={image.address}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open the full image of ${title}`}
      className={cn('shrink-0 border border-border', FOCUS)}
    >
      <img
        src={image.address}
        alt={`The stored image of ${title}`}
        className="block size-24 object-contain"
      />
    </a>
  );
}
