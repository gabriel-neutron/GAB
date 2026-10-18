import { isValidImo } from '@gab/proposal/identifiers';
import { releaseDay } from '@gab/release/release-day';
import type { NatoPair, SiteEntity, SiteRelease } from '@gab/release/site-release';
import { vesselFinderUrl } from '@gab/release/vessel-finder';
import { vesselLanes, type TimelineLane, type TimelineMark } from '@gab/release/vessel-timeline';

import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { EmptyState } from '@/shared/page/empty-state';
import { KeyValue } from '@/shared/page/key-value';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';

import { markTimeWords } from './mark-time';
import { TimelineFigure } from './timeline-figure';

export interface VesselPageProps {
  /** Null when the site holds no release: the timeline comes from a release and from nothing
   * else. */
  readonly release: SiteRelease | null;
  readonly imo: string;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
}

function NatoPairMark({ pair }: { readonly pair: NatoPair | null }) {
  if (pair === null) return null;
  return (
    <span className="font-mono text-muted-foreground" data-nato-pair="">
      {`NATO ${pair.letter}${pair.digit}`}
    </span>
  );
}

const columnsOf = (
  release: SiteRelease,
  entityHref: VesselPageProps['entityHref'],
): readonly DataColumn<TimelineMark>[] => [
  {
    key: 'mark',
    header: 'Mark',
    cell: (mark) => (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        {mark.otherId !== null && release.entityById.has(mark.otherId) ? (
          <a className={READING_LINK} href={entityHref(mark.otherId)}>
            {mark.words}
          </a>
        ) : (
          mark.words
        )}
        <NatoPairMark pair={mark.claim.pair} />
      </span>
    ),
  },
  { key: 'time', header: 'When', cell: (mark) => markTimeWords(mark.time) },
  { key: 'label', header: 'Label', cell: (mark) => mark.claim.originLabel },
];

function Lane({
  lane,
  columns,
}: {
  readonly lane: TimelineLane;
  readonly columns: readonly DataColumn<TimelineMark>[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium">{lane.words}</h3>
      <DataTable
        name={lane.words}
        columns={columns}
        rows={lane.marks.map((mark) => ({ id: mark.key, row: mark }))}
        empty=""
      />
    </div>
  );
}

function VesselTimeline({
  release,
  vessel,
  entityHref,
}: {
  readonly release: SiteRelease;
  readonly vessel: SiteEntity;
  readonly entityHref: VesselPageProps['entityHref'];
}) {
  const lanes = vesselLanes(release, vessel.id);
  const merged = [...release.aliases].filter(([, survivor]) => survivor === vessel.id);
  const marks = lanes.reduce((count, lane) => count + lane.marks.length, 0);
  const undated = lanes.reduce(
    (count, lane) => count + lane.marks.filter((one) => one.time.kind === 'no date').length,
    0,
  );
  return (
    <PageSection title={vessel.label}>
      <KeyValue
        entries={[
          {
            key: 'Page of the entity',
            value: (
              <a className={READING_LINK} href={entityHref(vessel.id)}>
                {vessel.label}
              </a>
            ),
          },
          { key: 'Identifier', value: vessel.id, figure: true },
          { key: 'Label', value: vessel.originLabel },
          ...(merged.length === 0
            ? []
            : [
                {
                  key: 'Merged identifiers',
                  value: merged.map(([absorbed]) => (
                    <p key={absorbed}>
                      <a className={READING_LINK} href={entityHref(absorbed)}>
                        {absorbed}
                      </a>
                    </p>
                  )),
                  figure: true as const,
                },
              ]),
        ]}
      />
      {marks === 0 ? (
        <EmptyState sentence="The release holds no former name, flag, owner, manager, insurer, designation or port call of this vessel." />
      ) : (
        <>
          <TimelineFigure lanes={lanes} versionDate={release.manifest.date} />
          {undated === 0 ? null : (
            <p
              className={
                undated === marks
                  ? 'text-muted-foreground'
                  : 'hidden text-muted-foreground md:block'
              }
            >
              {undated === marks
                ? 'No mark has a date, so the release draws no timeline. The lists give each mark.'
                : `${String(undated)} of ${String(marks)} marks have no date. The lists give them, and the drawing does not.`}
            </p>
          )}
          {lanes.map((lane) => (
            <Lane key={lane.key} lane={lane} columns={columnsOf(release, entityHref)} />
          ))}
        </>
      )}
    </PageSection>
  );
}

/** The page of the public vessels with one IMO number, on the reading scale: for each vessel, a
 * timeline of its former names, flags, owners, managers, insurers, designations and port calls.
 * A drawing shows the dated marks, and a list gives each mark in words. */
export function VesselPage({ release, imo, entityHref }: VesselPageProps) {
  const title = `IMO ${imo}`;
  if (release === null)
    return (
      <ReadingPage>
        <PageHeader title={title} />
        <EmptyState sentence="This site holds no release, and the timeline of a vessel comes from a release." />
      </ReadingPage>
    );
  const vessels = release.vesselsByImo.get(imo) ?? [];
  const version = releaseDay(release.manifest.date);
  return (
    <ReadingPage>
      <PageHeader title={title} detail={`From the release of ${version}`} />
      {vessels.length === 0 ? (
        <EmptyState sentence={`The release holds no vessel with the IMO number ${imo}.`} />
      ) : (
        <>
          <p className="max-w-prose">
            The life of the vessel as the claims of this release give it.
            <span className="hidden md:inline">
              {' '}
              A bar with an arrow is open: the release gives no end date, and the bar goes to the
              line of the version of {version}. A dashed bar has no known start. A dot is a day.
            </span>
          </p>
          {isValidImo(imo) ? null : (
            <p className="text-dissent">The check digit of this IMO number is wrong.</p>
          )}
          {vessels.length > 1 ? (
            <p>
              {String(vessels.length)} vessels of the release carry this IMO number. No merge joins
              them, so the page gives the timeline of each vessel apart.
            </p>
          ) : null}
          {vessels.map((vessel) => (
            <VesselTimeline
              key={vessel.id}
              release={release}
              vessel={vessel}
              entityHref={entityHref}
            />
          ))}
          <p lang="fr" className="flex flex-col gap-0.5 border-t border-border pt-3">
            <a
              className={READING_LINK}
              href={vesselFinderUrl(imo)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Position AIS déclarée (VesselFinder)
            </a>
            <span className="text-muted-foreground">
              Visualiseur externe, pas une source GAB. Position déclarée par le navire, peut être
              coupée ou falsifiée.
            </span>
          </p>
        </>
      )}
    </ReadingPage>
  );
}
