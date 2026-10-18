import { releaseDay } from '@gab/release/release-day';
import type { SiteRelease } from '@gab/release/site-release';

import { EmptyState } from '@/shared/page/empty-state';
import { PageHeader } from '@/shared/page/page-header';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';

export interface RelationPageProps {
  /** Null when the site holds no release. */
  readonly release: SiteRelease | null;
  readonly relationId: string;
  /** The address of the page of one claim. */
  readonly claimHref: (id: string) => string;
}

/** The page at the old address of a relation. A relation has its page at its claim, so this page
 * says so and links it. */
export function RelationPage({ release, relationId, claimHref }: RelationPageProps) {
  if (release === null)
    return (
      <ReadingPage>
        <PageHeader title="Relation" />
        <EmptyState sentence="This site holds no release, and a relation comes from a release." />
      </ReadingPage>
    );
  if (release.claimById.get(relationId)?.kind !== 'relation')
    return (
      <ReadingPage>
        <PageHeader title="Relation not found" />
        <EmptyState sentence="The release holds no relation with this identifier. The link that brought you here may be stale." />
      </ReadingPage>
    );
  return (
    <ReadingPage>
      <PageHeader
        title="Relation"
        detail={`From the release of ${releaseDay(release.manifest.date)}`}
      />
      <p>
        A relation has its page at its claim:{' '}
        <a className={READING_LINK} href={claimHref(relationId)}>
          the claim of this relation
        </a>
      </p>
    </ReadingPage>
  );
}
