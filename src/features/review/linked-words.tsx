import { linkedText } from './linked-text';

export interface LinkedWordsProps {
  readonly text: string;
}

/** A text with each address drawn as one link that names its host. The full address stays under
 * `title`, so a reader can check it before the click. */
export function LinkedWords({ text }: LinkedWordsProps) {
  return (
    <>
      {linkedText(text).map((part, index) =>
        part.kind === 'text' ? (
          // The parts of one text never move, so the position is their identity.
          <span key={index}>{part.text}</span>
        ) : (
          <a
            key={index}
            href={part.href}
            title={part.href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {part.host}
          </a>
        ),
      )}
    </>
  );
}
