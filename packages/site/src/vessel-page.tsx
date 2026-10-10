import { isValidImo } from '@gab/proposal/identifiers';

import { claimText } from './claim-text.ts';
import { NatoPairMark } from './nato-pair-mark.tsx';
import { releaseDay } from './release-day.ts';
import { SiteFrame } from './site-frame.tsx';
import { claimPage, entityPage, hrefFrom, vesselPage, type SitePath } from './site-paths.ts';
import type { SiteEntity, SiteRelease } from './site-release.ts';
import { LINK } from './site-style.ts';
import { TimelineFigure } from './timeline-figure.tsx';
import { vesselLanes, type MarkTime, type TimelineMark } from './vessel-timeline.ts';

export interface VesselPageProps {
  readonly release: SiteRelease;
  readonly imo: string;
}

const timeText = (time: MarkTime): string => {
  if (time.kind === 'day') return `On ${releaseDay(time.day)}.`;
  if (time.kind === 'no date') return 'The release gives no date.';
  const from = time.from === null ? 'Start unknown.' : `From ${releaseDay(time.from)}`;
  const to =
    time.to === null ? 'open: the release gives no end date.' : `to ${releaseDay(time.to)}.`;
  return time.from === null ? `${from} End ${to}` : `${from}, ${to}`;
};

function MarkItem({
  release,
  mark,
  here,
}: {
  readonly release: SiteRelease;
  readonly mark: TimelineMark;
  readonly here: SitePath;
}) {
  const { time } = mark;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      {mark.otherId !== null && release.entityById.has(mark.otherId) ? (
        <a className={LINK} href={hrefFrom(here, entityPage(mark.otherId))}>
          {mark.words}
        </a>
      ) : (
        <span>{mark.words}</span>
      )}
      <span className="tabular-nums">{timeText(time)}</span>
      <a
        className={LINK}
        href={hrefFrom(here, claimPage(mark.claim.id))}
        aria-label={`Claim: ${claimText(mark.claim)}`}
      >
        Claim
      </a>
      <NatoPairMark pair={mark.claim.pair} />
      {time.kind === 'interval' && time.endClaim !== null ? (
        <>
          <a
            className={LINK}
            href={hrefFrom(here, claimPage(time.endClaim.id))}
            aria-label={`End date: ${claimText(time.endClaim)}`}
          >
            End date
          </a>
          <NatoPairMark pair={time.endClaim.pair} />
        </>
      ) : null}
      <span className="text-muted-foreground">{mark.claim.originLabel}</span>
    </li>
  );
}

function VesselTimeline({
  release,
  vessel,
  here,
}: {
  readonly release: SiteRelease;
  readonly vessel: SiteEntity;
  readonly here: SitePath;
}) {
  const lanes = vesselLanes(release, vessel.id);
  const merged = [...release.aliases].filter(([, survivor]) => survivor === vessel.id);
  const undated = lanes.reduce(
    (count, lane) => count + lane.marks.filter((one) => one.time.kind === 'no date').length,
    0,
  );
  const marks = lanes.reduce((count, lane) => count + lane.marks.length, 0);
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-2">
      <h2 className="font-medium">
        <a className={LINK} href={hrefFrom(here, entityPage(vessel.id))}>
          {vessel.label}
        </a>
      </h2>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt className="text-label">Name in this release</dt>
        <dd>{vessel.label}</dd>
        <dt className="text-label">Identifier</dt>
        <dd className="font-mono break-all">{vessel.id}</dd>
        <dt className="text-label">Label</dt>
        <dd>{vessel.originLabel}</dd>
        {merged.length === 0 ? null : (
          <>
            <dt className="text-label">Merged identifiers</dt>
            <dd className="font-mono break-all">
              {merged.map(([absorbed]) => (
                <p key={absorbed}>
                  <a className={LINK} href={hrefFrom(here, entityPage(absorbed))}>
                    {absorbed}
                  </a>
                </p>
              ))}
            </dd>
          </>
        )}
      </dl>
      {marks === 0 ? (
        <p>
          The release holds no former name, flag, owner, manager, insurer, designation or port call
          of this vessel.
        </p>
      ) : (
        <>
          <TimelineFigure lanes={lanes} versionDate={release.manifest.date} here={here} />
          {undated === 0 ? null : (
            <p className="text-muted-foreground">
              {undated === marks
                ? 'No mark has a date, so the release draws no timeline. The list gives each mark.'
                : `${String(undated)} of ${String(marks)} marks have no date. The list gives them, and the drawing does not.`}
            </p>
          )}
          {lanes.map((lane) => (
            <section key={lane.key} className="flex flex-col gap-0.5">
              <h3 className="font-medium">{lane.words}</h3>
              <ul className="flex flex-col gap-1">
                {lane.marks.map((mark) => (
                  <MarkItem key={mark.key} release={release} mark={mark} here={here} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

/** The page of the public vessels with one IMO number: for each vessel, a timeline of its former
 * names, flags, owners, managers, insurers, designations and port calls. Each mark links to its
 * claim. A drawing shows the dated marks, and a list gives each mark in words. */
export function VesselPage({ release, imo }: VesselPageProps) {
  const vessels = release.vesselsByImo.get(imo) ?? [];
  if (vessels.length === 0) throw new Error(`the release has no vessel with the IMO number ${imo}`);
  const here = vesselPage(imo);
  const version = releaseDay(release.manifest.date);
  return (
    <SiteFrame release={release} page={{ path: here, title: `IMO ${imo}` }}>
      <p className="max-w-prose">
        The life of the vessel as the claims of this release give it. Each mark links to its claim.
        A bar with an arrow is open: the release gives no end date, and the bar goes to the line of
        the version of {version}. A dashed bar has no known start. A dot is a day.
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
        <VesselTimeline key={vessel.id} release={release} vessel={vessel} here={here} />
      ))}
    </SiteFrame>
  );
}
