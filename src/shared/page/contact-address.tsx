import { useEffect, useRef, useState } from 'react';
import { safeHref } from '@gab/release/safe-href';

import { READING_LINK } from './reading-link';

/** A mail address that a page shows only after a click, so a robot that reads the page markup
 * finds no address. A web address shows at once. */
export function ContactAddress({
  address,
  label,
}: {
  readonly address: string;
  /** Names the button for a screen reader, as "Report an error". */
  readonly label: string;
}) {
  const [shown, setShown] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (shown) link.current?.focus();
  }, [shown]);
  const href = safeHref(address);
  const text = address.replace(/^mailto:/u, '');
  if (!address.startsWith('mailto:') || shown)
    return href === null ? (
      <span className="break-all">{text}</span>
    ) : (
      <a ref={link} href={href} className={`${READING_LINK} break-all`}>
        {text}
      </a>
    );
  return (
    <button
      type="button"
      aria-label={`Show the address: ${label}`}
      className={`${READING_LINK} cursor-pointer`}
      onClick={() => {
        setShown(true);
      }}
    >
      Show the address
    </button>
  );
}
