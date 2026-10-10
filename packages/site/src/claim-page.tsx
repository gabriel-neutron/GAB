import { attributeName } from './attribute-name.ts';
import { claimText } from './claim-text.ts';
import { NatoPairMark } from './nato-pair-mark.tsx';
import { relationWords } from './relation-words.ts';
import { SiteFrame } from './site-frame.tsx';
import { claimPage, entityPage, hrefFrom, permanentAddress, type SitePath } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { LINK } from './site-style.ts';
import { SourceList } from './source-list.tsx';

export interface ClaimPageProps {
  readonly release: SiteRelease;
  readonly claimId: string;
}

function EntityLink({
  here,
  id,
  label,
}: {
  readonly here: SitePath;
  readonly id: string;
  readonly label: string;
}) {
  return (
    <a className={LINK} href={hrefFrom(here, entityPage(id))}>
      {label}
    </a>
  );
}

/** The permanent page of one claim: what it says, its label, its licence, and each of its
 * documents with the passages that hold the claim. */
export function ClaimPage({ release, claimId }: ClaimPageProps) {
  const claim = release.claimById.get(claimId);
  if (claim === undefined) throw new Error(`the release has no claim ${claimId}`);
  const here = claimPage(claim.id);
  return (
    <SiteFrame release={release} page={{ path: here, title: claimText(claim) }}>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
        {claim.kind === 'relation' ? (
          <>
            <dt className="text-label">From</dt>
            <dd>
              <EntityLink here={here} id={claim.relation.fromId} label={claim.relation.fromLabel} />
            </dd>
            <dt className="text-label">Relation</dt>
            <dd>{relationWords(claim.relation.type, false)}</dd>
            <dt className="text-label">To</dt>
            <dd>
              <EntityLink here={here} id={claim.relation.toId} label={claim.relation.toLabel} />
            </dd>
            <dt className="text-label">Valid from</dt>
            <dd className="font-mono tabular-nums">{claim.relation.validFrom}</dd>
            <dt className="text-label">Valid to</dt>
            <dd className="font-mono tabular-nums">{claim.relation.validTo}</dd>
          </>
        ) : (
          <>
            <dt className="text-label">Subject</dt>
            <dd>
              {claim.subjectKind === 'entity' ? (
                <EntityLink here={here} id={claim.subjectId} label={claim.subjectLabel} />
              ) : (
                <a className={LINK} href={hrefFrom(here, claimPage(claim.subjectId))}>
                  {claim.subjectLabel}
                </a>
              )}
            </dd>
            <dt className="text-label">Key</dt>
            <dd>{attributeName(claim.attribute)}</dd>
            <dt className="text-label">Value</dt>
            <dd>{claim.value}</dd>
          </>
        )}
        <dt className="text-label">Label</dt>
        <dd>{claim.originLabel}</dd>
        <dt className="text-label">Licence</dt>
        <dd>{claim.licence}</dd>
        {claim.pair === null ? null : (
          <>
            <dt className="text-label">NATO pair</dt>
            <dd>
              <NatoPairMark pair={claim.pair} />
            </dd>
          </>
        )}
        <dt className="text-label">Claim identifier</dt>
        <dd className="font-mono break-all">{claim.id}</dd>
        <dt className="text-label">Permanent address</dt>
        <dd className="font-mono break-all">
          {permanentAddress(release.manifest.iriBase, 'claim', claim.id)}
        </dd>
      </dl>
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Sources</h2>
        <SourceList sources={claim.sources} withPassages />
      </section>
    </SiteFrame>
  );
}
