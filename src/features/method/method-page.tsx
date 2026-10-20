import { Link } from '@tanstack/react-router';
import { releaseDay } from '@gab/release/release-day';
import type { SiteManifest } from '@gab/release/site-manifest';

import { CoverageStatement } from '@/shared/page/coverage-statement';
import { DisclaimerText } from '@/shared/page/disclaimer-text';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { SanctionsRules } from '@/shared/page/sanctions-rules';

export interface MethodPageProps {
  /** Null when the site holds no release: the method text carries the disclaimer of a release. */
  readonly manifest: SiteManifest | null;
}

const PROSE = 'max-w-prose';

/** The method page: the disclaimer with the meaning of each label, the licences, the rule of the
 * critical nodes, the merge candidates across two scripts, the permanent addresses and the rating
 * method. The NATO pair is explained only when the release shows it. */
export function MethodPage({ manifest }: MethodPageProps) {
  if (manifest === null)
    return (
      <ReadingPage>
        <PageHeader title="Method" />
        <p className="text-muted-foreground">
          This site holds no release, and the method page comes with a release.
        </p>
      </ReadingPage>
    );
  return (
    <ReadingPage>
      <PageHeader title="Method" detail={`From the release of ${releaseDay(manifest.date)}`} />

      {manifest.coverage === null ? null : (
        <PageSection title="What the record covers">
          <CoverageStatement
            coverage={manifest.coverage}
            release={{ version: manifest.version, date: manifest.date }}
          />
        </PageSection>
      )}

      <PageSection title="About this data and the labels">
        <DisclaimerText markdown={manifest.disclaimer} />
      </PageSection>

      <PageSection title="Glossary">
        <p className={PROSE}>
          The{' '}
          <Link to="/glossary" className={READING_LINK}>
            glossary
          </Link>{' '}
          gives the meaning of each term that a reader can mistake, and of each type of relation.
        </p>
      </PageSection>

      <PageSection title="The rating method">
        <p className={PROSE}>
          GAB rates each source and each fact apart. Each author of a source gets a rating of its
          reliability, from its record and from a reference set of authors that experts wrote. Each
          fact gets a rating of its credibility, from the number of independent authors that give it
          and from the conflicts between its sources. The rules accept a claim only from strong
          sources, and a claim that the rules cannot decide waits for the operator.
        </p>
        {manifest.showNatoPair ? (
          <p className={PROSE} data-nato-pair="">
            This release shows the NATO pair of each claim (STANAG 2511). The letter, from A
            (reliable) to F (cannot be judged), is the best rating among the authors whose sources
            support the fact. It rates the author, never the fact. The digit, from 1 (confirmed by
            independent sources) to 6 (cannot be judged), rates the credibility of the fact. It
            never reads a letter. A claim with no digit or with no known author shows no pair.
          </p>
        ) : (
          <p className={PROSE}>This release does not show the rating of a claim.</p>
        )}
      </PageSection>

      <PageSection title="Licences">
        <p className={PROSE}>
          The dataset is under CC-BY 4.0. Each row takes the most permissive licence of its public
          documents: CC-BY 4.0, CC-BY-NC 4.0, or "derived fact; source under the provider licence,
          not redistributed". A row with the last text gives a fact that GAB read in a source, and
          the release does not give the source data again.
        </p>
      </PageSection>

      <PageSection title="Sanctions on the map">
        <div className={`${PROSE} flex flex-col gap-2`}>
          <SanctionsRules manifest={manifest} />
        </div>
      </PageSection>

      <PageSection title="The critical nodes">
        <p className={PROSE}>
          A node is retained when two conditions of three have a sourced tick. Condition (a) comes
          from the public designations of the node itself. The operator ticks conditions (b) and (c)
          with the claims that support each tick, and the release refuses a tick that cites a claim
          that is not public. The release does not check that a claim supports its condition: that
          is the judgement of the operator. A tick with no public claim shows "not sourced", and it
          does not count, because it gives the reader nothing to check.
        </p>
      </PageSection>

      <PageSection title="One name in two scripts">
        <p className={PROSE}>
          A company or a place can have a Latin and a Cyrillic spelling. GAB transliterates each
          Russian name with the table of ICAO Doc 9303, folds the common variants of a few letters
          and drops the legal form. Two entities of one type with the same result are a merge
          candidate, and the operator confirms or refuses each candidate. No model proposes a
          candidate.
        </p>
        <p className={PROSE} data-name-candidates="">
          Candidates at this release: {manifest.nameCandidates.proposed} waiting,{' '}
          {manifest.nameCandidates.confirmed} confirmed, {manifest.nameCandidates.refused} refused.
        </p>
      </PageSection>

      <PageSection title="Permanent addresses">
        <p className={PROSE}>
          Each entity and each claim has a permanent address under{' '}
          <span className="font-mono break-all">{manifest.iriBase}</span>, the same identifier as in
          the linked data file. The address of an entity that a merge absorbed opens the entity that
          replaces it.
        </p>
      </PageSection>
    </ReadingPage>
  );
}
