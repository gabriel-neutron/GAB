import { attributeName } from '@gab/release/attribute-name';
import { claimText } from '@gab/release/claim-text';
import { releaseDay } from '@gab/release/release-day';
import { permanentAddress } from '@gab/release/site-paths';
import type { SiteRelease } from '@gab/release/site-release';
import { relationWords } from '@gab/proposal/relation-types';

import { EmptyState } from '@/shared/page/empty-state';
import { KeyValue, type KeyValueEntry } from '@/shared/page/key-value';
import { NatoPairMark } from '@/shared/page/nato-pair-mark';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { SourceEntry } from '@/shared/page/source-entry';

export interface ClaimPageProps {
  /** Null when the site holds no release: a claim comes from a release and from nothing else. */
  readonly release: SiteRelease | null;
  readonly claimId: string;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
  /** The address of the page of one claim. */
  readonly claimHref: (id: string) => string;
}

type Claim = NonNullable<ReturnType<SiteRelease['claimById']['get']>>;

function linkTo(href: string, words: string) {
  return (
    <a className={READING_LINK} href={href}>
      {words}
    </a>
  );
}

const factsOf = (
  claim: Claim,
  entityHref: ClaimPageProps['entityHref'],
  claimHref: ClaimPageProps['claimHref'],
): readonly KeyValueEntry[] => {
  if (claim.kind === 'relation') {
    const { relation } = claim;
    return [
      { key: 'From', value: linkTo(entityHref(relation.fromId), relation.fromLabel) },
      { key: 'Relation', value: relationWords(relation.type, false) },
      { key: 'To', value: linkTo(entityHref(relation.toId), relation.toLabel) },
      { key: 'Valid from', value: relation.validFrom, figure: true },
      { key: 'Valid to', value: relation.validTo, figure: true },
    ];
  }
  return [
    {
      key: 'Subject',
      value: linkTo(
        claim.subjectKind === 'entity' ? entityHref(claim.subjectId) : claimHref(claim.subjectId),
        claim.subjectLabel,
      ),
    },
    { key: 'Key', value: attributeName(claim.attribute) },
    { key: 'Value', value: claim.value },
  ];
};

/** The permanent page of one claim, on the reading scale: what it says, its label, its licence,
 * and each of its documents with the passages that hold the claim. It reads its props only, so a
 * release step can write it as HTML. */
export function ClaimPage({ release, claimId, entityHref, claimHref }: ClaimPageProps) {
  if (release === null)
    return (
      <ReadingPage>
        <PageHeader title="Claim" />
        <EmptyState sentence="This site holds no release, and a claim comes from a release." />
      </ReadingPage>
    );
  const claim = release.claimById.get(claimId);
  if (claim === undefined)
    return (
      <ReadingPage>
        <PageHeader title="Claim not found" />
        <EmptyState sentence="The release holds no claim with this identifier. The link that brought you here may be stale." />
      </ReadingPage>
    );
  return (
    <ReadingPage>
      <PageHeader
        title={claimText(claim)}
        detail={`From the release of ${releaseDay(release.manifest.date)}`}
      />
      <KeyValue
        entries={[
          ...factsOf(claim, entityHref, claimHref),
          { key: 'Label', value: claim.originLabel },
          { key: 'Licence', value: claim.licence },
          ...(claim.pair === null
            ? []
            : [{ key: 'NATO pair', value: <NatoPairMark pair={claim.pair} /> }]),
          { key: 'Claim identifier', value: claim.id, figure: true },
          {
            key: 'Permanent address',
            value: permanentAddress(release.manifest.iriBase, 'claim', claim.id),
            figure: true,
          },
        ]}
      />
      <PageSection title="Sources">
        {claim.sources.length === 0 ? (
          <EmptyState sentence="The release names no document here." />
        ) : (
          claim.sources.map((source) => <SourceEntry key={source.documentId} source={source} />)
        )}
      </PageSection>
    </ReadingPage>
  );
}
