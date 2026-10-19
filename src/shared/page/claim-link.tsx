import type { NatoPair } from '@gab/release/site-release';

import { NatoPairMark } from './nato-pair-mark';
import { READING_LINK } from './reading-link';

export interface ClaimLinkProps {
  /** What the claim says, or the short word that names the link. */
  readonly text: string;
  readonly href: string;
  /** The accessible name when `text` is only a short word. */
  readonly label?: string;
  readonly pair: NatoPair | null;
}

/** A link to the permanent page of a claim, with its NATO pair when the release shows it. */
export function ClaimLink({ text, href, label, pair }: ClaimLinkProps) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <a className={READING_LINK} href={href} aria-label={label}>
        {text}
      </a>
      <NatoPairMark pair={pair} />
    </span>
  );
}
