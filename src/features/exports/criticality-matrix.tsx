import type { AlignmentListing, AlignmentRegime, AlignmentRow } from '@gab/release/alignment-rows';
import { pairRating, type SiteRelease } from '@gab/release/site-release';

import { cn } from '@/shared/lib/utils';
import { ClaimLink } from '@/shared/page/claim-link';
import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { READING_LINK } from '@/shared/page/reading-link';

import type { ReportLinks } from './report-links';
import { listingWords, matrixCounts } from './matrix-cells';

export interface CriticalityMatrixProps {
  readonly release: SiteRelease;
  readonly title: string;
  readonly links: ReportLinks;
}

const REGIMES: readonly { readonly key: AlignmentRegime; readonly header: string }[] = [
  { key: 'eu', header: 'EU' },
  { key: 'ofac', header: 'OFAC' },
  { key: 'uk', header: 'UK' },
];

const gapWords = (row: AlignmentRow): string =>
  [row.euNotOfac ? 'EU, not OFAC' : '', row.ofacOrUkNotEu ? 'OFAC or UK, not EU' : '']
    .filter((one) => one !== '')
    .join('; ');

/** The criticality matrix: one row for each vessel number that a regime lists, and one column for
 * each regime. A cell gives a mark and the date in words, the day when the listing ended when the
 * release has it, the act as a link to its page, and the ADMIRALTY pair of the listing claim. */
export function CriticalityMatrix({ release, title, links }: CriticalityMatrixProps) {
  const counts = matrixCounts(release.alignment);

  const listingCell = (listing: AlignmentListing | null) => {
    const words = listingWords(listing);
    const claim = listing === null ? undefined : release.claimById.get(listing.claimId);
    return (
      <span className="flex flex-col gap-0.5">
        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span aria-hidden="true">{words.mark}</span>
          {listing === null ? (
            <span>{words.words}</span>
          ) : claim === undefined ? (
            <span>{`${words.words} (no claim page)`}</span>
          ) : (
            <ClaimLink
              text={words.words}
              label={`Listing of ${words.words}`}
              href={links.claim(claim.id)}
              rating={pairRating(release.manifest, claim)}
            />
          )}
        </span>
        {words.endedOn === null ? null : <span>{`ended ${words.endedOn}`}</span>}
        {listing === null ? null : release.entityById.has(listing.actId) ? (
          <a className={READING_LINK} href={links.entity(listing.actId)}>
            {listing.actLabel}
          </a>
        ) : (
          <span className="text-label">{listing.actLabel}</span>
        )}
      </span>
    );
  };

  const columns: DataColumn<AlignmentRow>[] = [
    {
      key: 'vessel',
      header: 'Vessel',
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          {row.vesselIds.map((id, place) =>
            release.entityById.has(id) ? (
              <a key={id} className={READING_LINK} href={links.entity(id)}>
                {row.vesselLabels[place] ?? id}
              </a>
            ) : (
              <span key={id}>{row.vesselLabels[place] ?? id}</span>
            ),
          )}
          {release.vesselsByImo.has(row.imo) ? (
            <a className={cn(READING_LINK, 'font-mono')} href={links.vessel(row.imo)}>
              {`IMO ${row.imo}`}
            </a>
          ) : (
            <span className="font-mono">{`IMO ${row.imo}`}</span>
          )}
        </span>
      ),
    },
    ...REGIMES.map(({ key, header }): DataColumn<AlignmentRow> => ({
      key,
      header,
      figure: 'text',
      cell: (row) => listingCell(row.listings[key]),
    })),
    { key: 'gap', header: 'Gap', cell: (row) => gapWords(row) || null },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-sm text-label">
        <strong className="font-normal text-foreground">{`Table 1. ${title}.`}</strong>
      </p>
      <DataTable
        name={title}
        columns={columns}
        rows={release.alignment.map((row) => ({ id: row.imo, row }))}
        empty="This release holds no alignment matrix."
      />
      {counts.rows === 0 ? null : (
        <div className="flex flex-col gap-1 text-body-sm text-label" data-matrix-legend="">
          <p>
            ● is a listing, with the date that the release gives. ○ is no listing in this release,
            and it is not a legal permission. Each date follows the date rule of its regime.
          </p>
          <p>
            {`${String(counts.rows)} vessel numbers. Listed by OFAC or the UK and not by the EU: ${String(counts.ofacOrUkNotEu)}. Listed by the EU and not by OFAC: ${String(counts.euNotOfac)}.`}
          </p>
          <p>
            {counts.ended === 0
              ? 'This release records no end date for a listing. The table shows the status on the day of the release, and a removal is not shown.'
              : `${String(counts.ended)} vessel numbers have a listing with an end date.`}
          </p>
        </div>
      )}
    </div>
  );
}
