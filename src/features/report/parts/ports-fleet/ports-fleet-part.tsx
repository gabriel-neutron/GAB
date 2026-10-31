import { lazy, Suspense, useRef, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, parts, portsFleetUi, type ReportBlock, type ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { BigNumber } from '../../primitives/big-number';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { StickyScene } from '../../primitives/sticky-scene';
import { RichText } from '../../rich-text';
import { figureData } from './figure-data';
import { FleetFlows } from './fleet-flows';
import { PortTraffic } from './port-traffic';
import { splitSentences } from './sentences';
import { TERMINALS } from './terminals';
import { VesselLives } from './vessel-lives';
import './map-scene.css';

import type { MapSources } from './port-map';

const PortMap = lazy(() => import('./port-map').then((module) => ({ default: module.PortMap })));

const PROSE = 'max-w-[64ch] text-[18px]/[1.65] md:text-[20px]/[1.65] lg:ml-[25%]';
const copy = portsFleetUi;
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
const texts = figureTexts.figures;
// The cards of the map scene: a range of sentences of a paragraph, and the state of the map that
// the card sets.
const SCENE = [
  { block: 0, from: 5, to: 6, state: 0 },
  { block: 0, from: 6, to: 8, state: 1 },
  { block: 1, from: 0, to: 2, state: 2 },
  { block: 1, from: 2, to: 4, state: 3 },
  { block: 1, from: 4, to: 6, state: 3 },
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
// Figure 6 has one unit for each panel: a, b, then c.
const unit6 = [...texts['6'].panels.map((panel) => panel.unit), copy.traffic.cUnit]
  .filter((one) => one !== '')
  .join(' · ');
// The two notes of a figure of the PDF read as one note under the chart.
// Figure 7 has one unit for each kind of panel.
const unit7 = [...new Set(texts['7'].panels.map((panel) => panel.unit))]
  .filter((one) => one !== '')
  .join(' · ');
const notes = {
  '6': `${texts['6'].note} ${texts['6'].noteB}`,
  '7': `${texts['7'].note} ${texts['7'].noteB}`,
  '8': fill(texts['8'].note),
};

/** Exporting through the ports and the fleet: a typographic chapter break, a sticky map of the
 * export terminals under the first two paragraphs, then the figures of traffic, flows and ships. */
export function PortsFleetPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const scene = useReducedMotion() === true ? STATIC_SCENE : SCENE;
  const text = (index: number) => part.blocks[index]?.text ?? '';
  const figure = (index: number) => part.blocks[index]?.figure;
  const first = splitSentences(text(0));
  const second = splitSentences(text(1));
  const say = (sentences: readonly string[]) => (
    <RichText text={sentences.join(' ')} partSlug={part.slug} />
  );
  // Each card of the scene holds whole sentences of the first two paragraphs, in their order, and
  // sets one state of the map. The long last state takes two cards, so a card stays short on a phone.
  const cards = scene.map(({ block, from, to, state }, index) => (
    <div key={`${String(block)}-${String(from)}`} className="pf-step" data-pf-card={index}>
      <p className="mb-2 font-mono text-caption uppercase text-label md:mb-3">
        <span className="text-foreground tabular-nums">
          {String(state + 1).padStart(2, '0')} / {String(copy.map.kickers.length).padStart(2, '0')}
        </span>{' '}
        · {copy.map.kickers[state]}
      </p>
      <p className="text-[15px]/[1.5] md:text-[17px]/[1.6]">
        {say((block === 0 ? first : second).slice(from, to))}
      </p>
    </div>
  ));
  const paragraph = (index: number) => (
    <Reveal>
      <p className={cn('my-8', PROSE)}>
        <RichText text={text(index)} partSlug={part.slug} />
      </p>
    </Reveal>
  );

  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} quote={copy.quote} image={copy.art}>
        <ul
          aria-label={copy.terminals}
          className="mt-10 grid max-w-[56rem] grid-cols-1 gap-x-8 border-t border-border pt-4 font-mono text-small/5 text-label sm:grid-cols-2"
        >
          {TERMINALS.map((terminal) => (
            <li key={terminal.id} className="flex justify-between gap-4 tabular-nums">
              <span className="text-foreground uppercase">{terminal.label}</span>
              <span className="text-foreground/75">
                {terminal.lat.toFixed(2)} N · {terminal.lon.toFixed(2)} E
              </span>
            </li>
          ))}
        </ul>
      </ChapterBreak>

      <div className="pt-12 md:pt-16">
        <Reveal>
          <p className={PROSE}>{say(first.slice(0, 5))}</p>
        </Reveal>
      </div>

      <MapScene
        scene={scene}
        steps={cards}
        sources={{ change: figure(2)?.sources ?? '', flows: figure(4)?.sources ?? '' }}
      />

      <Figure facts={figure(2)} note={notes['6']} partSlug={part.slug} unit={unit6}>
        <PortTraffic />
      </Figure>
      {paragraph(3)}
      <Figure facts={figure(4)} note={notes['7']} partSlug={part.slug} unit={unit7}>
        <FleetFlows />
      </Figure>
      {paragraph(5)}
      <div className="my-16 grid items-start gap-14 border-y border-border py-12 md:grid-cols-2 md:gap-x-12">
        {copy.numbers.map((one) => (
          <Reveal key={one.value}>
            <BigNumber
              value={one.value}
              label={one.label}
              note={{ partSlug: part.slug, id: one.note }}
            />
          </Reveal>
        ))}
      </div>
      <Figure facts={figure(6)} note={notes['8']} partSlug={part.slug} period={copy.lives.period}>
        <VesselLives />
      </Figure>
      {paragraph(7)}
      <div className="my-16 border-y border-border py-12">
        <Reveal>
          <BigNumber
            value={copy.usFirst.value}
            label={copy.usFirst.label}
            note={{ partSlug: part.slug, id: copy.usFirst.note }}
          />
        </Reveal>
      </div>
      <Reveal>
        <p className="mx-auto max-w-[28ch] py-16 text-center text-[clamp(1.75rem,4.4vw,3.5rem)] leading-[1.08] tracking-[-0.035em] text-balance md:py-28">
          <RichText text={text(8)} partSlug={part.slug} />
        </p>
      </Reveal>
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
  );
}

interface FigureProps {
  readonly facts: ReportBlock['figure'];
  readonly note: string;
  readonly partSlug: string;
  /** The period and the unit when the figure facts give none. */
  readonly period?: string;
  readonly unit?: string;
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
