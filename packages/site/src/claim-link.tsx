import { claimText } from './claim-text.ts';
import { NatoPairMark } from './nato-pair-mark.tsx';
import { LINK } from './site-style.ts';
import { claimPage, hrefFrom, type SitePath } from './site-paths.ts';
import type { SiteClaim } from './site-release.ts';

/** A link to the permanent page of a claim, with its NATO pair when the release shows it. */
export function ClaimLink({ claim, here }: { readonly claim: SiteClaim; readonly here: SitePath }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <a className={LINK} href={hrefFrom(here, claimPage(claim.id))}>
        {claimText(claim)}
      </a>
      <NatoPairMark pair={claim.pair} />
    </span>
  );
}
