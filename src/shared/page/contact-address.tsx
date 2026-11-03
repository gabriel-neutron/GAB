import { useState } from 'react';
import { safeHref } from '@gab/release/safe-href';

import { READING_LINK } from './reading-link';

/** A mail address that a page shows only after a click, so a robot that reads the page markup
 * finds no address. */
export function ContactAddress({ address }: { readonly address: string }) {
  const [shown, setShown] = useState(false);
  const href = safeHref(address);
  const text = address.replace(/^mailto:/u, '');
  if (!shown)
    return (
      <button
        type="button"
        className={`${READING_LINK} cursor-pointer`}
        onClick={() => {
          setShown(true);
        }}
      >
        Show the address
      </button>
    );
  return href === null ? (
    <span className="break-all">{text}</span>
  ) : (
    <a href={href} className={`${READING_LINK} break-all`}>
      {text}
    </a>
  );
}
