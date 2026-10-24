// The motion of the animated mode. The adapter owns the map and calls `show` when the step in view
// changes; this file times what happens next. Nothing here touches React: each frame writes to the
// map directly.

import { PRODUCTS, type ProductKey } from '@gab/proposal/chain-product';
import type { ExpressionSpecification, LineLayerSpecification, Map as MapLibre } from 'maplibre-gl';
import { animate, backOut, cubicBezier, easeInOut, easeOut } from 'motion';

import { frameOf } from './globe-view';
import type { GlobeData } from './globe-data';
import { revealOf, waveProgress, type StepIds } from './chain-reveal';

// The feature state `reveal` goes from 0 (out of sight) to 1 (drawn). A feature with no state is
// drawn, so the globe with no step in view needs no state at all.
const REVEAL: ExpressionSpecification = ['coalesce', ['feature-state', 'reveal'], 1];

/** A paint expression that a reveal of 0 hides. */
export const revealed = (
  value: number | ExpressionSpecification,
  factor: number | ExpressionSpecification = 1,
): ExpressionSpecification => ['*', value, factor, REVEAL];

const CLEAR = 'rgba(0,0,0,0)';
// The head of the flow that runs along a link.
const FLOW = '#ffffff';
// Origin of the number: a link takes about as long to cross as the camera takes to fly, so the
// flow reads as slow and not as a flicker.
const FLOW_S = 2.6;

const drawLayer = (key: ProductKey): string => `draw-${key}`;
export const flowLayer = (key: ProductKey): string => `pulse-${key}`;

/** The draw-on of the links of one step: a solid line, cut at the progress along the line. */
export const drawLayers = (): LineLayerSpecification[] =>
  PRODUCTS.map((one) => ({
    id: drawLayer(one.key),
    type: 'line',
    source: 'arcs',
    filter: ['==', ['get', 'id'], ''],
    layout: { 'line-cap': 'butt', visibility: 'none' },
    paint: {
      'line-width': ['get', 'width'],
      'line-gradient': ['step', ['line-progress'], one.colour, 0, CLEAR],
    },
  }));

/** The flow of the links: a short white head that runs along each flow of the record. */
export const flowLayers = (visibility: 'visible' | 'none'): LineLayerSpecification[] =>
  PRODUCTS.map((one) => ({
    id: flowLayer(one.key),
    type: 'line',
    source: 'arcs',
    filter: [
      'all',
      ['==', ['get', 'product'], one.key],
      ['!=', ['get', 'style'], 'in review'],
      ['!=', ['get', 'style'], 'capacity'],
    ],
    layout: { 'line-cap': 'round', visibility },
    paint: { 'line-width': 3, 'line-gradient': flowAt(0.5) },
  }));

/** A gradient along a line, with a head at `progress` (0 to 1) and a short tail behind it. */
const flowAt = (progress: number): ExpressionSpecification => {
  // Origin of the numbers: an interpolation needs its inputs in strictly ascending order, so the
  // head stays between 0.13 and 0.97, with a tail of 0.12 and a front of 0.02.
  const head = 0.13 + 0.84 * Math.min(Math.max(progress, 0), 1);
  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    0,
    CLEAR,
    head - 0.12,
    CLEAR,
    head,
    FLOW,
    head + 0.02,
    CLEAR,
    1,
    CLEAR,
  ];
};

const drawAt = (colour: string, progress: number): ExpressionSpecification =>
  progress <= 0
    ? ['step', ['line-progress'], CLEAR, 0, CLEAR]
    : ['step', ['line-progress'], colour, progress, CLEAR];

// The seconds of one step, from the moment it comes in. The camera flies first, the assets rise
// as it lands, the links draw on, and the rest of the time is the reader's to read.
const FLY_S = 1.6;
const ASSETS = { at: 0.7, for: 1.1 } as const;
const EXITS = { at: 1.0, for: 0.9 } as const;
const LINKS = { at: 1.3, for: 1.7 } as const;
// The share of the draw-on, at its end, in which the solid line gives way to the styled link.
const HANDOFF = 0.25;
// The share of the time of a group over which its features start one after the other.
const SPREAD = 0.6;
const PADDING = 60;
const MAX_ZOOM = 5;
const STEP_EASE = cubicBezier(0.4, 0, 0.2, 1);

type Source = 'entities' | 'arcs' | 'exits';

const KINDS: readonly {
  readonly source: Source;
  readonly of: (ids: StepIds) => readonly string[];
}[] = [
  { source: 'entities', of: (ids) => ids.assets },
  { source: 'arcs', of: (ids) => ids.arcs },
  { source: 'exits', of: (ids) => ids.exits },
];

export interface ChainAnimation {
  /** Puts a step in view, or none. With `moving` false the final state is drawn at once and the
   * camera jumps. With `camera` false the camera stays where it is. */
  readonly show: (
    key: string | null,
    options: { readonly moving: boolean; readonly camera: boolean },
  ) => void;
  /** Starts or stops the flow along the links. */
  readonly flow: (running: boolean) => void;
  readonly destroy: () => void;
}

export function createChainAnimation(map: MapLibre, data: GlobeData): ChainAnimation {
  const everything = frameOf(
    data.places,
    data.entities.features.map((one) => one.id),
  );
  const everyId: StepIds = {
    assets: data.entities.features.map((one) => one.id),
    arcs: data.arcs.features.map((one) => one.properties.id),
    exits: data.exits.features.map((one) => one.properties.id),
  };
  const west = (id: string): number => data.places.get(id)?.[0]?.[0] ?? 0;
  // The sweep goes from the west to the east.
  const sweep = (ids: readonly string[]): string[] => [...ids].sort((a, b) => west(a) - west(b));

  let timeline: ReturnType<typeof animate> | null = null;
  let running: ReturnType<typeof animate> | null = null;

  const setState = (source: Source, ids: readonly string[], reveal: number): void => {
    for (const id of ids) map.setFeatureState({ source, id }, { reveal });
  };

  const fly = (ids: StepIds | null, moving: boolean): void => {
    const box =
      ids === null ? everything : frameOf(data.places, [...ids.assets, ...ids.arcs, ...ids.exits]);
    if (box === null) return;
    if (!moving) {
      map.fitBounds(box, { padding: PADDING, maxZoom: ids === null ? 4 : MAX_ZOOM, duration: 0 });
      return;
    }
    const camera = map.cameraForBounds(box, {
      padding: PADDING,
      maxZoom: ids === null ? 4 : MAX_ZOOM,
    });
    if (camera?.center === undefined || camera.zoom === undefined) return;
    map.flyTo({
      center: camera.center,
      zoom: camera.zoom,
      duration: FLY_S * 1000,
      curve: 1.2,
      easing: STEP_EASE,
    });
  };

  const hideDraw = (): void => {
    for (const one of PRODUCTS) map.setLayoutProperty(drawLayer(one.key), 'visibility', 'none');
  };

  const show: ChainAnimation['show'] = (key, { moving, camera }) => {
    timeline?.stop();
    timeline = null;
    hideDraw();
    for (const { source } of KINDS) map.removeFeatureState({ source });
    const reveal = revealOf(data.steps, key, everyId);
    if (reveal === null) {
      if (camera) fly(null, moving);
      return;
    }
    for (const { source, of } of KINDS) setState(source, of(reveal.hidden), 0);
    if (camera) fly(reveal.entering, moving);
    if (!moving) return;

    const assets = sweep(reveal.entering.assets);
    const exits = sweep(reveal.entering.exits);
    const links = reveal.entering.arcs;
    setState('entities', assets, 0);
    setState('exits', exits, 0);
    setState('arcs', links, 0);

    const linkProducts = PRODUCTS.filter((one) =>
      links.some((id) => data.arcInfo[id]?.product === one.key),
    );
    const linkIds = ['literal', links] satisfies ExpressionSpecification;
    for (const one of linkProducts) {
      map.setFilter(drawLayer(one.key), [
        'all',
        ['==', ['get', 'product'], one.key],
        ['in', ['get', 'id'], linkIds],
      ]);
      map.setLayoutProperty(drawLayer(one.key), 'visibility', 'visible');
      map.setPaintProperty(drawLayer(one.key), 'line-opacity', 1);
    }

    const group = (ids: readonly string[], source: Source) => (progress: number) => {
      ids.forEach((id, rank) => {
        const local = waveProgress(progress, rank, ids.length, SPREAD);
        map.setFeatureState({ source, id }, { reveal: backOut(local) });
      });
    };
    const drawOn = (progress: number): void => {
      const drawn = easeInOut(progress);
      const handoff = Math.min(Math.max((progress - (1 - HANDOFF)) / HANDOFF, 0), 1);
      for (const one of linkProducts) {
        map.setPaintProperty(drawLayer(one.key), 'line-gradient', drawAt(one.colour, drawn));
        map.setPaintProperty(drawLayer(one.key), 'line-opacity', 1 - easeOut(handoff));
      }
      if (handoff > 0) setState('arcs', links, easeOut(handoff));
    };

    const segment = (when: { readonly at: number; readonly for: number }) =>
      ({ at: when.at, duration: when.for, ease: 'linear' }) as const;
    timeline = animate([
      [group(assets, 'entities'), segment(ASSETS)],
      [group(exits, 'exits'), segment(EXITS)],
      [drawOn, segment(LINKS)],
    ]);
    void timeline.then(hideDraw);
  };

  return {
    show,
    flow: (on) => {
      if (!on) {
        running?.pause();
        return;
      }
      if (running !== null) {
        running.play();
        return;
      }
      running = animate(0, 1, {
        duration: FLOW_S,
        ease: 'linear',
        repeat: Infinity,
        onUpdate: (progress) => {
          for (const one of PRODUCTS)
            map.setPaintProperty(flowLayer(one.key), 'line-gradient', flowAt(progress * 1.15));
        },
      });
    },
    destroy: () => {
      timeline?.stop();
      running?.stop();
    },
  };
}
