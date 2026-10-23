import { Link } from '@tanstack/react-router';

import { attributeName } from '@gab/release/attribute-name';
import { claimText } from '@gab/release/claim-text';
import { valueWords } from '@gab/release/value-elements';
import { releaseDay } from '@gab/release/release-day';
import { permanentAddress } from '@gab/release/site-paths';
import { pairRating, type SiteRelease } from '@gab/release/site-release';
import { relationWords } from '@gab/proposal/relation-types';

import { EmptyState } from '@/shared/page/empty-state';
import { LabelBadge } from '@/shared/page/label-badge';
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

const NOT_RECORDED = 'not recorded';

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
      { key: 'Valid from', value: relation.validFrom ?? NOT_RECORDED, figure: true },
      { key: 'Valid to', value: relation.validTo ?? NOT_RECORDED, figure: true },
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
    { key: 'Value', value: valueWords(claim.value) },
  ];
};

/** The permanent page of one claim, on the reading scale: what it says, its label, its licence,
 * and each of its documents with the passages that hold the claim. It reads its props only, so a
 * release step can write it as HTML. */
// An identifier that cannot be a path has no permanent address, and the page still shows the claim.
function addressOf(base: string, id: string): string {
  try {
    return permanentAddress(base, 'claim', id);
  } catch {
    return '';
  }
}

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
  const rating = pairRating(release.manifest, claim);
  return (
    <ReadingPage>
      <PageHeader
        title={claimText(claim)}
        detail={`From the release of ${releaseDay(release.manifest.date)}`}
      />
      <KeyValue
        entries={[
          ...factsOf(claim, entityHref, claimHref),
          ...(rating.shown ? [{ key: 'Rating', value: <NatoPairMark rating={rating} /> }] : []),
          { key: 'Decided by', value: <LabelBadge label={claim.originLabel} /> },
        ]}
      />
      {rating.shown ? (
        <p className="max-w-prose text-xs/5 text-muted-foreground">
          A rating is a letter and a digit. The letter, from A (reliable) to F (cannot be judged),
          rates the author of the source. The digit, from 1 (confirmed by independent sources) to 6
          (cannot be judged), rates the credibility of the fact. "Not rated" means that the letter
          or the digit is not known for this claim. See{' '}
          <Link to="/method" className={READING_LINK}>
            the method
          </Link>
          .
        </p>
      ) : null}
      <details className="text-xs/5">
        <summary className="cursor-pointer text-label">Licence and permanent address</summary>
        <div className="pt-1">
          <KeyValue
            entries={[
              { key: 'Licence', value: claim.licence },
              { key: 'Claim identifier', value: claim.id, figure: true },
              {
                key: 'Permanent address',
                value: addressOf(release.manifest.iriBase, claim.id),
                figure: true,
              },
            ]}
          />
        </div>
      </details>
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
