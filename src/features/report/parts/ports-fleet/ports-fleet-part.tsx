import { lazy, Suspense, useRef, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import type { ReportBlock, ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { StickyScene } from '../../primitives/sticky-scene';
import { RichText } from '../../rich-text';
import { useContent } from '../../use-content';
import { figureData } from './figure-data';
import { FleetFlows } from './fleet-flows';
import { REGIMES, selectWaves } from './fleet-waves';
import { FleetWavesFigure } from './fleet-waves-figure';
import { PortTraffic } from './port-traffic';
import { portVisits } from './port-visits';
import { splitSentences } from './sentences';
import { VesselLives } from './vessel-lives';
import { visitLayer } from './visit-layer';
import './map-scene.css';

import type { MapSources } from './port-map';

const PortMap = lazy(() => import('./port-map').then((module) => ({ default: module.PortMap })));
// The table of the port visits needs no map, so it loads with the page.
const VISITS_ON = portVisits.on(import.meta.env);

const PROSE = 'max-w-[64ch] text-report-body/[1.65]  lg:ml-[25%]';
const census = figureData.lives.census;
const values: Readonly<Record<string, number>> = {
  'F.census.read': census.read,
  'F.census.ais': census.ais,
  'F.census.fol24': census.fol24,
  'F.census.eu24b': census.eu24b,
  'F.census.eu24a': census.eu24a,
  lanesN: figureData.lives.groups.reduce((sum, group) => sum + group.lanes.length, 0),
};
const fill = (text: string) =>
  text.replace(/\{([^}]+)\}/g, (whole, key: string) => String(values[key] ?? whole));
// The cards of the map scene: a range of sentences of a paragraph (its place in the blocks), and
// the state of the map that the card sets: 0 the port ban, 1 the export ports, 2 the change of
// traffic, 3 the flows by fleet. The blocks before the last card are the scene; a heading among
// them opens the card that follows it.
const SCENE = [
  { block: 1, from: 0, to: 1, state: 1 },
  { block: 1, from: 1, to: 2, state: 2 },
  { block: 2, from: 0, to: 3, state: 0 },
  { block: 4, from: 0, to: 2, state: 3 },
  { block: 4, from: 2, to: 4, state: 3 },
] as const;
type Scene = readonly { block: number; from: number; to: number; state: number }[];
// Under reduced motion each card shows its own frame of the map: the cards of one state join, so
// no frame shows twice.
const STATIC_SCENE: Scene = SCENE.reduce<
  { block: number; from: number; to: number; state: number }[]
>((out, one) => {
  const last = out.at(-1);
  if (last?.state === one.state && last.block === one.block && last.to === one.from)
    out[out.length - 1] = { ...last, to: one.to };
  else out.push({ ...one });
  return out;
}, []);
const SCENE_END = Math.max(...SCENE.map((card) => card.block));
// The charts of the figures of the part.
const charts: Readonly<Partial<Record<number, () => ReactNode>>> = {
  6: PortTraffic,
  7: FleetFlows,
  8: VesselLives,
  9: FleetWavesFigure,
};
const waves = selectWaves(new Set(REGIMES));
const stripNotes = (text: string) => text.replace(/\[\^[^\]]+\]/g, '');

/** Exporting through the ports and the fleet: a typographic chapter break, a sticky map of the
 * export terminals under the paragraphs on the ports and the fleet, then the figures of traffic,
 * flows and ships between the paragraphs. The last paragraph closes the part in large type. */
export function PortsFleetPart({ part }: { readonly part: ReportPart }) {
  const { figureTexts, parts, portsFleetUi: copy } = useContent();
  const texts = figureTexts.figures;
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const scene = useReducedMotion() === true ? STATIC_SCENE : SCENE;
  const figureOf = (n: number) => part.blocks.find((block) => block.figure?.number === n)?.figure;
  // Figure 6 has one unit for each panel: a, b, then c. Figure 7 has one unit for each kind of
  // panel. The two notes of a figure of the PDF read as one note under the chart.
  const units: Readonly<Partial<Record<number, string>>> = {
    6: [...texts['6'].panels.map((panel) => panel.unit), copy.traffic.cUnit]
      .filter((one) => one !== '')
      .join(' · '),
    7: [...new Set(texts['7'].panels.map((panel) => panel.unit))]
      .filter((one) => one !== '')
      .join(' · '),
    9: copy.waves.unit,
  };
  const periods: Readonly<Partial<Record<number, string>>> = {
    8: copy.lives.period,
    9: `${waves.quarters[0]?.quarter ?? ''} – ${waves.end}`,
  };
  const notes: Readonly<Partial<Record<number, string>>> = {
    6: `${texts['6'].note} ${texts['6'].noteB}`,
    7: `${texts['7'].note} ${texts['7'].noteB}`,
    8: fill(texts['8'].note),
  };
  const say = (text: string) => <RichText text={text} partSlug={part.slug} />;
  // Each card holds whole sentences of a paragraph, in their order, and sets one state of the map.
  const cards = scene.map(({ block, from, to }, index) => {
    const heading = part.blocks[block - 1];
    return (
      <div key={`${String(block)}-${String(from)}`} className="pf-step" data-pf-card={index}>
        {/* The first heading stands over the scene, so no card repeats it. */}
        {from === 0 && block > 1 && heading?.kind === 'h3' ? (
          <h3 className="mb-2 text-report-lead text-balance">{heading.text}</h3>
        ) : null}
        <p className="text-report-small/[1.5] ">
          {say(
            splitSentences(part.blocks[block]?.text ?? '')
              .slice(from, to)
              .join(' '),
          )}
        </p>
      </div>
    );
  });
  const opening = part.blocks[0]?.kind === 'h3' ? part.blocks[0].text : undefined;
  const rest = part.blocks.slice(SCENE_END + 1);
  const last = rest.findLastIndex((block) => block.kind === 'p');
  const body = rest.map((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${part.slug}-${String(SCENE_END + 1 + index)}`;
    if (block.kind === 'figure') {
      const n = block.figure?.number ?? 0;
      const Chart = charts[n];
      if (Chart === undefined) return null;
      return (
        <Figure
          key={key}
          facts={block.figure}
          note={notes[n] ?? ''}
          partSlug={part.slug}
          unit={units[n]}
          period={periods[n]}
        >
          <Chart />
        </Figure>
      );
    }
    if (block.kind === 'h3')
      return (
        <h3 key={key} className={cn(PROSE, 'mt-16 text-report-lead text-balance')}>
          {block.text}
        </h3>
      );
    if (index === last)
      return (
        <Reveal key={key}>
          <p className="mx-auto max-w-[28ch] py-16 text-center text-report-heading leading-[1.08] tracking-[-0.035em] text-balance md:py-28">
            {say(block.text)}
          </p>
        </Reveal>
      );
    return (
      <Reveal key={key}>
        <p className={cn('my-8', PROSE)}>{say(block.text)}</p>
      </Reveal>
    );
  });

  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} image={copy.art} />

      {opening === undefined ? null : (
        <div className="pt-12 md:pt-16">
          <h3 className={cn(PROSE, 'text-report-lead text-balance')}>{opening}</h3>
        </div>
      )}

      <MapScene
        scene={scene}
        steps={cards}
        sources={{
          change: stripNotes(figureOf(6)?.sources ?? ''),
          flows: stripNotes(figureOf(7)?.sources ?? ''),
        }}
      />

      {body}
    </section>
  );
}

/** The sticky map scene. The map loads when the scene comes near the view. */
function MapScene({
  scene,
  steps,
  sources,
}: {
  readonly scene: Scene;
  readonly steps: readonly ReactNode[];
  readonly sources: MapSources;
}) {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, { once: true, margin: '800px 0px' });
  // Under 1024px the lower quarter of the map is the faded room of the card: the next figure comes
  // up over it, so no empty band stands between the map and the figure.
  return (
    <>
      <div ref={box} className="pf-scene mt-16 max-lg:motion-safe:-mb-[25svh]">
        <StickyScene steps={steps}>
          {(step) => (
            <>
              {/* The step in view, for the cards of map-scene.css. */}
              <span hidden data-pf-active={step} />
              {near ? (
                <Suspense fallback={null}>
                  <PortMap step={scene[step]?.state ?? 0} sources={sources} />
                </Suspense>
              ) : null}
            </>
          )}
        </StickyScene>
      </div>
      {/* The port visits as a table, out of the sticky map, so it never stays over the map. Under
          1024px it comes up over the faded room of the map, as the next figure did. */}
      {VISITS_ON ? (
        <div className={cn(PROSE, 'relative bg-background')}>
          <visitLayer.Table />
        </div>
      ) : null}
    </>
  );
}

interface FigureProps {
  readonly facts: ReportBlock['figure'];
  readonly note: string;
  readonly partSlug: string;
  /** The period and the unit when the figure facts give none. */
  readonly period?: string | undefined;
  readonly unit?: string | undefined;
  readonly children: ReactNode;
}

/** A figure of the part, wider than the text, in its frame with the unit, the period, the
 * sources and the note. */
function Figure({ facts, note, partSlug, period, unit, children }: FigureProps) {
  if (facts === undefined) return null;
  return (
    <Reveal>
      <FigureFrame
        number={facts.number}
        title={facts.title}
        unit={facts.unit ?? unit}
        period={facts.period ?? period}
        sources={facts.sources}
        note={note}
        partSlug={partSlug}
        plate
      >
        {children}
      </FigureFrame>
    </Reveal>
  );
}
