import { useRef } from 'react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, portsFleetUi } from '../../content';
import { accent } from '../../primitives/accent';
import { Reveal } from '../../primitives/reveal';
import { figureData, type Lane } from './figure-data';
import { useSize } from './use-size';

const labels: Readonly<Record<string, string>> = figureTexts.figures['8'].labels;
const groupNames: Readonly<Record<string, string>> = figureTexts.dataLabels;
const { before, after, census, groups } = figureData.lives;
const lanesN = groups.reduce((sum, group) => sum + group.lanes.length, 0);
const at = (day: number) =>
  ((Math.max(-before, Math.min(after, day)) + before) / (before + after)) * 100;
const pct = (value: number) => `${value.toFixed(3)}%`;
const label = (key: string, values: Readonly<Record<string, string | number>> = {}) =>
  (labels[key] ?? key).replace(/\{(\w+)\}/g, (whole, name: string) =>
    String(values[name] ?? whole),
  );

const STATS = [
  {
    key: 'perdent dans les 12 mois leur identité AIS liée au numéro OMI (navires suivis 12 mois)',
    value: String(census.lose12[0] ?? ''),
    of: census.lose12[1],
  },
  {
    key: 'font encore escale 6 mois ou plus après leur désignation (suivis 6 mois)',
    value: String(census.c6[0] ?? ''),
    of: census.c6[1],
  },
  {
    key: 'font encore escale 12 mois ou plus après leur désignation (suivis 12 mois)',
    value: String(census.c12[0] ?? ''),
    of: census.c12[1],
  },
  {
    key: 'font escale dans un port de l’UE : 6 mois avant, puis 24 mois après leur désignation (un minimum)',
    value: `${String(census.euB[0] ?? '')} → ${String(census.euA[0] ?? '')}`,
    of: census.euB[1],
  },
];
const TICKS = [
  { day: -before, text: label('{m} mois', { m: -6 }) },
  { day: 0, text: label('désignation') },
  { day: 182, text: label('+6 mois') },
  { day: 365, text: label('+12 mois') },
  { day: after, text: label('{m} mois', { m: '+24' }) },
];

/** Figure 8: four shares of the census of designated tankers, then the AIS identity and the port
 * calls of a few ships, aligned on the day of their designation. Calls after it take the accent. */
export function VesselLives() {
  return (
    <div>
      <p className="mb-6 font-mono text-small text-label">
        {label(
          'Chiffres : les {ais} pétroliers désignés qui ont une identité AIS. Frise : {lanesN} navires, exemples de chaque profil.',
          { ais: census.ais, lanesN },
        )}
      </p>

      <div
        role="img"
        aria-label={portsFleetUi.lives.label.replace('{n}', String(lanesN))}
        className="mt-10"
      >
        <div aria-hidden="true">
          <div className="relative ml-0 h-8 md:ml-[11rem]">
            {TICKS.map((tick) => (
              <span
                key={tick.day}
                className={cn(
                  'absolute top-0 font-mono text-small whitespace-nowrap',
                  tick.day === 0 ? 'text-foreground' : 'text-label',
                  tick.day === -before
                    ? ''
                    : tick.day === after
                      ? '-translate-x-full'
                      : '-translate-x-1/2',
                  // Under 480px only the designation and the end of the period keep a label.
                  tick.day === 0 || tick.day === after ? '' : 'hidden min-[480px]:block',
                )}
                style={{ left: pct(at(tick.day)) }}
              >
                {tick.text}
              </span>
            ))}
          </div>
          {groups.map((group) => (
            <Reveal key={group.name}>
              <div className="border-t border-border pt-2 pb-3">
                <p className="mb-1 font-mono text-caption uppercase text-label">
                  {groupNames[group.name] ?? group.name}
                </p>
                {group.lanes.map((lane) => (
                  <LaneRow key={lane.name} lane={lane} />
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-small text-muted-foreground">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-5 bg-foreground/60" />
          {label('pavillon russe')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-5 border border-foreground/60" />
          {label('autre pavillon (code ISO)')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-5 border-t border-dashed border-label" />
          {label('hors de la période lue')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-px bg-foreground" />
          {label('changement de pavillon (piste)')}
        </li>
        <li>
          {label('Escales :')} {label('au-dessus : port russe')} ·{' '}
          {label('au-dessous : autre port')} · {label('triangle : port de l’UE')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className={cn('h-2 w-0.5', accent.bg)} />
          {portsFleetUi.lives.after}
        </li>
      </ul>
      <Census />
    </div>
  );
}

/** The census under the timeline: the lost identities as one value and one dot for each tanker,
 * then the port calls as a row of smaller values. */
function Census() {
  const [lost, of] = census.lose12;
  const [first, ...rest] = STATS;
  if (first === undefined || lost === undefined || of === undefined) return null;
  return (
    <div className="mt-16 border-t border-foreground pt-8">
      <Reveal>
        <p className="flex flex-wrap items-baseline gap-x-5 leading-[0.85] tracking-[-0.055em] tabular-nums">
          <span className={cn('text-[clamp(6rem,22vw,14rem)]', accent.text)}>{lost}</span>
          <span className="text-[clamp(2.5rem,8vw,5.5rem)] text-label">
            {label('sur {n}', { n: of })}
          </span>
        </p>
        <p className="mt-4 max-w-[48ch] font-mono text-caption/4 uppercase text-label">
          {label(first.key)}
        </p>
        <div
          role="img"
          aria-label={`${String(lost)} ${label('sur {n}', { n: of })} ${portsFleetUi.lives.lost}`}
          className="mt-8 flex flex-wrap gap-1 md:gap-1.5"
        >
          {Array.from({ length: of }, (_, index) => (
            <span
              // The dots are one count with no identity of their own, so their place is their key.
              key={index}
              aria-hidden="true"
              className={cn(
                'size-1.5 md:size-2',
                index < lost ? accent.bg : 'border border-chart-neutral',
              )}
            />
          ))}
        </div>
        <p className="mt-3 font-mono text-small text-label">{portsFleetUi.lives.lost}</p>
      </Reveal>
      <dl className="mt-14 grid gap-x-10 gap-y-10 md:grid-cols-3">
        {rest.map((stat) => (
          <div key={stat.key} className="flex flex-col border-t border-border pt-4">
            <dt className="order-2 mt-3 max-w-[34ch] text-body-sm text-muted-foreground">
              {label(stat.key)}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x-3 text-[clamp(3rem,6vw,4.5rem)] leading-[0.9] tracking-[-0.05em] tabular-nums">
              {stat.value}
              <span className="font-mono text-small tracking-normal text-label">
                {label('sur {n}', { n: stat.of ?? '' })}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The room of one flag code and its gap, in pixels: 3 + 4 characters of 10px mono.
const FLAG_ROOM = 7 * 6;

function LaneRow({ lane }: { readonly lane: Lane }) {
  const track = useRef<HTMLDivElement>(null);
  const { width } = useSize(track);
  // Each flag code takes the lowest row where it stays clear of the code before it.
  const ends: number[] = [];
  const rowOf = new Map(
    lane.identities
      .filter((identity) => identity.flag !== 'RUS')
      .map((identity) => {
        const x = (at(identity.from) / 100) * width;
        const free = ends.findIndex((end) => x >= end);
        const row = free < 0 ? ends.length : free;
        ends[row] = x + FLAG_ROOM;
        return [identity, row] as const;
      }),
  );
  return (
    <div className="grid items-center gap-x-4 py-1.5 md:grid-cols-[10rem_1fr]">
      <p className="font-mono text-small text-foreground break-words">{lane.name}</p>
      {/* The flag codes stand above the row of calls, in the room this margin keeps. */}
      <div
        ref={track}
        className="relative h-9"
        style={{ marginTop: ends.length === 0 ? 0 : ends.length * 11 + 2 }}
      >
        {/* The designation day. */}
        <span className="absolute inset-y-0 w-px bg-foreground" style={{ left: pct(at(0)) }} />
        {lane.end < after ? (
          <span
            className="absolute top-1/2 border-t border-dashed border-label"
            style={{ left: pct(at(lane.end)), right: 0 }}
          />
        ) : null}
        {lane.identities.length === 0 ? (
          <span className="absolute top-1/2 left-0 -translate-y-1/2 font-mono text-small text-label">
            {label('aucune identité AIS suivie')}
          </span>
        ) : null}
        {lane.identities.map((identity) => {
          const russian = identity.flag === 'RUS';
          return (
            <span
              key={`${String(identity.from)}-${identity.flag}`}
              className={cn(
                'absolute top-1/2 h-1.5 -translate-y-1/2',
                russian ? 'bg-foreground/60' : 'border border-foreground/60',
              )}
              style={{
                left: pct(at(identity.from)),
                width: pct(at(identity.to) - at(identity.from)),
              }}
            >
              {russian ? null : (
                <span
                  className="absolute left-0 font-mono text-[10px]/3 text-label"
                  style={{ top: -29 - (rowOf.get(identity) ?? 0) * 11 }}
                >
                  {identity.flag}
                </span>
              )}
            </span>
          );
        })}
        {lane.flagChanges.map((day) => (
          <span
            key={day}
            className="absolute top-1 h-7 w-px bg-foreground"
            style={{ left: pct(at(day)) }}
          />
        ))}
        {lane.calls.map((call, index) => {
          const late = call.day >= 0;
          const eu = call.kind === 'E';
          // Two calls can share a day: their place in the list keeps them apart.
          const key = `${String(call.day)}-${String(index)}`;
          return eu ? (
            <span
              key={key}
              className={cn(
                'absolute top-[calc(50%+5px)] size-0 -translate-x-1/2 border-x-[4px] border-b-[7px] border-x-transparent',
                late ? 'border-b-signal' : 'border-b-label',
              )}
              style={{ left: pct(at(call.day)) }}
            />
          ) : (
            <span
              key={key}
              className={cn(
                'absolute h-2 w-0.5',
                call.kind === 'R' ? 'top-[calc(50%-14px)]' : 'top-[calc(50%+6px)]',
                late ? accent.bg : 'bg-label',
              )}
              style={{ left: pct(at(call.day)) }}
            />
          );
        })}
      </div>
    </div>
  );
}
