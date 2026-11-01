import { useEffect, useId, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useContent } from '../../use-content';
import { cn } from '@/shared/lib/utils';
import { useReport } from '../../use-report';
import type { Arc, Place, Tone } from './chain-data';
import { fitCrop, placeLabels, ringHolds } from './layouts';
import { GLYPH, type PlantMark } from './plants-data';

interface Site {
  readonly id: string;
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
}

interface Crop {
  readonly west: number;
  readonly east: number;
  readonly south: number;
  readonly north: number;
}

// Equirectangular, one unit for one degree: the boxes the map must hold. The map widens each box
// to fill its frame, up to a cap of latitudes. The world box is the band of the routes, from the
// Atlantic to the Pacific: the United States is past its west edge and shows as an edge marker.
// The Russia box holds the sites, with room around them for their numbers. The plants box holds
// the defence plants, from the Baltic to the Pacific.
export const CROPS = {
  world: { west: -20, east: 135, south: 2, north: 70 },
  russia: { west: 26, east: 70, south: 50, north: 62 },
  plants: { west: 28, east: 140, south: 47, north: 67 },
} as const satisfies Record<string, Crop>;
const MAX_LAT = { world: 80, russia: 60, plants: 44 } as const;
// On a phone the world box narrows to the corridor from Europe to the Pacific, with more latitudes,
// so that the map is taller and its labels have room.
const CORRIDOR: Crop = { west: -8, east: 124, south: 2, north: 66 };
const CORRIDOR_MAX_LAT = 100;

interface ChainMapProps {
  readonly crop: keyof typeof CROPS;
  /** The labelled places of the step. */
  readonly places: readonly Place[];
  /** All the routes; `lit` draws them all, else only the routes with a labelled place at each end. */
  readonly arcs: readonly Arc[];
  readonly lit: boolean;
  /** The sites to draw; an empty list hides them. */
  readonly sites: readonly Site[];
  /** The defence plants to draw, by main weapon. They enter once, from west to east. */
  readonly plants?: readonly PlantMark[] | undefined;
  /** The name of the map for a screen reader. */
  readonly label?: string | undefined;
}

interface Land {
  readonly all: string;
  readonly russia: string;
}

const pathOf = (rings: readonly number[][][]) =>
  rings
    .map(
      (ring) =>
        ring
          .map(([lon = 0, lat = 0], index) => `${index === 0 ? 'M' : 'L'}${lon},${-lat}`)
          .join('') + 'Z',
    )
    .join('');

// The file names no country: Russia is the country whose land holds Moscow.
const MOSCOW = [37.6, 55.75] as const;

let landPath: Promise<Land> | undefined;
// shortcut: the land loads once for the page and is never freed; fine for one map.
const loadLand = (): Promise<Land> => {
  landPath ??= import('@gab/proposal/countries.json?raw').then(({ default: raw }) => {
    const data = JSON.parse(raw) as {
      features: { geometry: { type: string; coordinates: unknown } }[];
    };
    const all: number[][][] = [];
    let russia: number[][][] = [];
    for (const { geometry } of data.features) {
      const own: number[][][] = [];
      if (geometry.type === 'Polygon') own.push(...(geometry.coordinates as number[][][]));
      if (geometry.type === 'MultiPolygon')
        for (const polygon of geometry.coordinates as number[][][][]) own.push(...polygon);
      all.push(...own);
      if (own.some((ring) => ringHolds(ring, ...MOSCOW))) russia = own;
    }
    return { all: pathOf(all), russia: pathOf(russia) };
  });
  return landPath;
};

const MARK: Record<Tone, string> = {
  accent: 'bg-signal',
  ink: 'bg-foreground',
  dim: 'bg-muted-foreground',
};
// On the light ground the accent text is darker, so a thin label stays legible.
const TEXT: Record<Tone, string> = {
  accent: 'text-[color-mix(in_oklab,var(--signal)_78%,black)] dark:text-signal',
  ink: 'text-foreground',
  dim: 'text-foreground',
};
const LINE: Record<Tone, string> = {
  accent: 'stroke-signal',
  ink: 'stroke-foreground',
  dim: 'stroke-muted-foreground',
};
const SITE_TONE: Tone = 'accent';
const DASH: Readonly<Record<string, string>> = { lead: '6 4', 'no source found': '1.5 4' };

// A label is 13px mono: a glyph is 0.6em wide, plus the padding of its halo.
const FONT = 13;
const labelSize = (text: string) => ({ w: text.length * FONT * 0.6 + 8, h: FONT + 6 });

// The Ural range as a reference line of the Russia map: approximate, for drawing only.
const URALS = [
  [58.6, 51.4],
  [59.3, 54],
  [59.6, 56.5],
  [59.3, 59],
  [59.4, 61.5],
  [60.2, 64],
  [61.5, 66],
] as const;
const URALS_TOP = URALS[URALS.length - 1] ?? [0, 0];

const pad = (n: number) => String(n).padStart(2, '0');
const spanOf = (crop: Crop) => crop.east - crop.west;
// The gap in pixels between an edge marker and the edge of the map.
const EDGE_INSET = 8;

/** The map of the chain story: the land as a grid of dots with Russia in stronger ink, the places
 * of the step in view with their labels on leader lines, the routes figure, the sites of
 * the Fight layer, each with its number on a short leader, and the defence plants by main weapon. The map fills its
 * frame; it loads the land only near the view. */
export function ChainMap({
  crop: cropName,
  places,
  arcs,
  lit,
  sites,
  plants = [],
  label = fightUi.chain.mapLabel,
}: ChainMapProps) {
  const frame = useRef<HTMLDivElement>(null);
  const near = useInView(frame, { once: true, margin: '600px 0px' });
  const seen = useInView(frame, { once: true, amount: 0.4 });
  const [land, setLand] = useState<Land | undefined>(undefined);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dots = useId();
  const reduce = useReducedMotion();
  const { openNode } = useReport();
  const { fightUi } = useContent();

  // An adapter: the land file loads past React, once, when the map comes near the view.
  useEffect(() => {
    if (!near) return undefined;
    let live = true;
    void loadLand().then((loaded) => {
      if (live) setLand(loaded);
    });
    return () => {
      live = false;
    };
  }, [near]);

  // An adapter: the map fills its frame and places its labels in pixels, so it reads its size.
  useEffect(() => {
    const node = frame.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry?.contentRect.width ?? 0, h: entry?.contentRect.height ?? 0 });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Every map but the world map is a map of Russia: it draws its border and the Urals.
  const russia = cropName !== 'world';
  const corridor = !russia && size.w < 480;
  const crop = fitCrop(
    corridor ? CORRIDOR : CROPS[cropName],
    size.w,
    size.h,
    corridor ? CORRIDOR_MAX_LAT : MAX_LAT[cropName],
  );
  const { w: width, h: height } = crop;
  const spanX = crop.east - crop.west;
  const spanY = crop.north - crop.south;
  const x = (lon: number) => ((lon - crop.west) / spanX) * width;
  const y = (lat: number) => ((crop.north - lat) / spanY) * height;
  // One dot for each 4.5 pixels, at every size.
  const cell = width === 0 ? 1 : (spanX / width) * 4.5;
  const grid = spanX > 100 ? 30 : 5;
  const fade = reduce === true ? false : { opacity: 0 };

  // A route shows only when the step names both of its ends, so no route ends in empty land.
  const named = new Set(places.map((place) => place.name));
  const shown = arcs.filter((arc) => lit || (named.has(arc.from.name) && named.has(arc.to.name)));
  // On a phone the plants sit too close for their labels: the map shows the points only, and the
  // table under the map names each plant.
  const labelled = cropName === 'plants' && size.w < 480 ? [] : places;
  // Places on one point share one label: "EU 12% / Europe".
  const merged = new Map<string, { place: Place; text: string }>();
  for (const place of labelled) {
    const at = `${String(place.lon)},${String(place.lat)}`;
    const text = `${place.name}${place.value === undefined ? '' : ` ${place.value}`}`;
    const held = merged.get(at);
    merged.set(
      at,
      held === undefined ? { place, text } : { ...held, text: `${held.text} / ${text}` },
    );
  }
  // A place past the edge of the crop is an edge marker: a plain label at a fixed inset from the
  // edge, with its value. The origin of a route past the edge gets one too, so no route starts
  // in the frame.
  for (const arc of shown) {
    const at = `${String(arc.from.lon)},${String(arc.from.lat)}`;
    const raw = x(arc.from.lon);
    if ((raw < 0 || raw > width) && !merged.has(at))
      merged.set(at, { place: arc.from, text: arc.from.name });
  }
  const all = [...merged.values()].map(({ place, text }) => {
    const raw = x(place.lon);
    const edge = raw < 0 ? 'west' : raw > width ? 'east' : null;
    return { place, raw, edge, py: y(place.lat), name: text };
  });
  const edges = all.flatMap((mark) => {
    if (mark.edge === null) return [];
    const text = mark.edge === 'west' ? `◂ ${mark.name}` : `${mark.name} ▸`;
    const size = labelSize(text);
    const top = Math.min(Math.max(mark.py - size.h / 2, 0), height - size.h);
    const left = mark.edge === 'west' ? EDGE_INSET : width - size.w - EDGE_INSET;
    return [
      { key: mark.place.name, place: mark.place, text, tone: mark.place.tone, left, top, ...size },
    ];
  });
  const marks = all
    .filter((mark) => mark.edge === null)
    .map((mark) => ({ place: mark.place, px: mark.raw, py: mark.py, text: mark.name }));
  // Russia, where every chain ends: a fixed terminal mark of the world map, with the first claim
  // on the room for labels.
  const terminal = russia
    ? null
    : { px: x(MOSCOW[0]), py: y(MOSCOW[1]), text: fightUi.chain.russia };
  const boxes = placeLabels(
    [
      ...(terminal === null
        ? []
        : [{ x: terminal.px, y: terminal.py, ...labelSize(terminal.text) }]),
      ...marks.map((mark) => ({ x: mark.px, y: mark.py, ...labelSize(mark.text) })),
    ],
    width,
    height,
    edges.map((edge) => ({ x: edge.left, y: edge.top, w: edge.w, h: edge.h })),
  );
  const terminalBox = terminal === null ? null : (boxes[0] ?? null);
  const markBoxes = terminal === null ? boxes : boxes.slice(1);
  // An arc from a place past the edge starts at the inner end of its edge marker.
  const lonOf = (px: number) => crop.west + (px / Math.max(width, 1)) * spanX;
  const latOf = (py: number) => crop.north - (py / Math.max(height, 1)) * spanY;
  const inCrop = (place: Place): Place => {
    const edge = edges.find((one) => one.place.lon === place.lon && one.place.lat === place.lat);
    if (edge === undefined) return place;
    const px = edge.left < width / 2 ? edge.left + edge.w : edge.left;
    return { ...place, lon: lonOf(px), lat: latOf(edge.top + edge.h / 2) };
  };
  const labels = marks.flatMap((mark, index) => {
    const at = markBoxes[index];
    return at === null || at === undefined ? [] : [{ ...mark, at }];
  });

  // The sites: a number next to each diamond, on its own short leader. Sites closer than one
  // diamond share one diamond and one label ("04 05 06"). The names are in the list of the step.
  const siteGroups: { key: string; px: number; py: number; text: string }[] = [];
  sites.forEach((site, index) => {
    const px = x(site.lon);
    const py = y(site.lat);
    const near = siteGroups.find((group) => Math.hypot(group.px - px, group.py - py) < 10);
    if (near === undefined) siteGroups.push({ key: site.id, px, py, text: pad(index + 1) });
    else near.text += ` ${pad(index + 1)}`;
  });
  const uralsAt = { x: x(URALS_TOP[0]), y: Math.max(4, y(URALS_TOP[1]) - 16) };
  const uralsBox = { ...labelSize(fightUi.chain.urals), x: 0, y: uralsAt.y };
  const siteBoxes = placeLabels(
    siteGroups.map((group) => ({ x: group.px, y: group.py, ...labelSize(group.text) })),
    width,
    height,
    russia ? [{ ...uralsBox, x: uralsAt.x - uralsBox.w / 2 }] : [],
  );
  const siteLabels = siteGroups.flatMap((group, index) => {
    const at = siteBoxes[index];
    return at === null || at === undefined ? [] : [{ ...group, at }];
  });

  const textLabels = [
    ...labels.map((label) => ({
      key: label.place.name,
      text: label.text,
      tone: label.place.tone,
      left: label.at.x,
      top: label.at.y,
    })),
    ...siteLabels.map((label) => ({
      key: label.key,
      text: label.text,
      tone: SITE_TONE,
      left: label.at.x,
      top: label.at.y,
    })),
  ];

  return (
    <div ref={frame} className="relative size-full">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height }}>
        <svg
          role="img"
          aria-label={label}
          viewBox={`${String(crop.west)} ${String(-crop.north)} ${String(spanX)} ${String(spanY)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <defs>
            <pattern id={`${dots}-a`} width={cell} height={cell} patternUnits="userSpaceOnUse">
              <rect width={cell * 0.42} height={cell * 0.42} className="fill-foreground/25" />
            </pattern>
            <pattern id={`${dots}-r`} width={cell} height={cell} patternUnits="userSpaceOnUse">
              <rect width={cell * 0.5} height={cell * 0.5} className="fill-foreground/40" />
            </pattern>
          </defs>
          {Array.from({ length: 73 }, (_unused, index) => -180 + index * 5)
            .filter((lon) => lon % grid === 0 && lon > crop.west && lon < crop.east)
            .map((lon) => (
              <line
                key={`lon-${String(lon)}`}
                x1={lon}
                x2={lon}
                y1={-crop.north}
                y2={-crop.south}
                vectorEffect="non-scaling-stroke"
                className="stroke-chart-grid"
                strokeWidth={1}
              />
            ))}
          {Array.from({ length: 37 }, (_unused, index) => -90 + index * 5)
            .filter((lat) => lat % grid === 0 && lat > crop.south && lat < crop.north)
            .map((lat) => (
              <line
                key={`lat-${String(lat)}`}
                x1={crop.west}
                x2={crop.east}
                y1={-lat}
                y2={-lat}
                vectorEffect="non-scaling-stroke"
                className="stroke-chart-grid"
                strokeWidth={1}
              />
            ))}
          {land === undefined ? null : (
            <>
              <path
                d={land.all}
                fill={`url(#${dots}-a)`}
                vectorEffect="non-scaling-stroke"
                strokeWidth={0.75}
                className={russia ? 'stroke-foreground/25' : 'stroke-none'}
              />
              <path
                d={land.russia}
                fill={`url(#${dots}-r)`}
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
                className="stroke-foreground/45"
              />
            </>
          )}
          {russia ? (
            <polyline
              points={URALS.map(([lon, lat]) => `${String(lon)},${String(-lat)}`).join(' ')}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              className="stroke-muted-foreground"
            />
          ) : null}
          {shown.map((arc) => {
            const from = inCrop(arc.from);
            const to = inCrop(arc.to);
            const lift = Math.hypot(to.lon - from.lon, to.lat - from.lat) * 0.3;
            return (
              <motion.path
                key={`${arc.from.name}-${arc.to.name}-${arc.state}`}
                d={`M${String(from.lon)},${String(-from.lat)} Q${String((from.lon + to.lon) / 2)},${String(-(from.lat + to.lat) / 2 - lift)} ${String(to.lon)},${String(-to.lat)}`}
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeWidth={2 + arc.weight * 0.4}
                strokeDasharray={DASH[arc.state]}
                initial={fade}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={arc.to.tone === 'accent' ? 'stroke-signal' : 'stroke-foreground'}
              />
            );
          })}
        </svg>
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          {labels.map((label) => {
            const ex = Math.min(Math.max(label.px, label.at.x), label.at.x + label.at.w);
            const ey = Math.min(Math.max(label.py, label.at.y), label.at.y + label.at.h);
            return (
              <line
                key={label.place.name}
                x1={label.px}
                y1={label.py}
                x2={ex}
                y2={ey}
                strokeWidth={1}
                className={LINE[label.place.tone]}
              />
            );
          })}
          {siteLabels.map((label) => (
            <line
              key={label.key}
              x1={label.px}
              y1={label.py}
              x2={Math.min(Math.max(label.px, label.at.x), label.at.x + label.at.w)}
              y2={Math.min(Math.max(label.py, label.at.y), label.at.y + label.at.h)}
              strokeWidth={1}
              className="stroke-signal/60"
            />
          ))}
          {plants.map((plant) => (
            <g
              key={plant.name}
              data-plant={plant.name}
              transform={`translate(${String(x(plant.lon))},${String(y(plant.lat))})`}
            >
              <motion.g
                initial={reduce === true ? false : { opacity: 0, scale: 0 }}
                animate={
                  seen || reduce === true ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }
                }
                transition={{
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                  delay: ((plant.lon - CROPS.plants.west) / spanOf(CROPS.plants)) * 0.8,
                }}
                className={
                  plant.approximate
                    ? 'fill-background stroke-foreground'
                    : 'fill-foreground stroke-background'
                }
              >
                {GLYPH[plant.glyph] === undefined ? (
                  <circle r={3} />
                ) : (
                  <path d={GLYPH[plant.glyph]} />
                )}
              </motion.g>
            </g>
          ))}
        </svg>
        {russia ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 bg-background px-1 py-[3px] font-mono text-report-label/none tracking-[0.2em] text-muted-foreground uppercase"
            style={{ left: uralsAt.x, top: uralsAt.y }}
          >
            {fightUi.chain.urals}
          </span>
        ) : null}
        {marks.map((mark) => (
          <motion.span
            key={mark.place.name}
            aria-hidden="true"
            initial={fade}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn('absolute -mt-1 -ml-1 size-2', MARK[mark.place.tone])}
            style={{ left: mark.px, top: mark.py }}
          />
        ))}
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            aria-label={`${fightUi.chain.openSite}: ${site.name}`}
            onClick={(event) => {
              openNode(site.id, event.currentTarget);
            }}
            className="group absolute -mt-[22px] -ml-[22px] grid size-11 place-items-center outline-none focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-ring"
            style={{ left: x(site.lon), top: y(site.lat) }}
          >
            <span className="size-2.5 rotate-45 border border-signal bg-background group-hover:bg-signal" />
          </button>
        ))}
        {terminal === null ? null : (
          <>
            <span
              aria-hidden="true"
              className="absolute -mt-[6px] -ml-[6px] size-3 rotate-45 bg-signal ring-2 ring-background"
              style={{ left: terminal.px, top: terminal.py }}
            />
            {terminalBox === null ? null : (
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute bg-background px-1 py-[3px] font-mono text-report-label tracking-[0.12em] whitespace-nowrap uppercase',
                  TEXT.accent,
                )}
                style={{ left: terminalBox.x, top: terminalBox.y }}
              >
                {terminal.text}
              </span>
            )}
          </>
        )}
        {edges.map((edge) => (
          <motion.span
            key={edge.key}
            aria-hidden="true"
            initial={fade}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'pointer-events-none absolute bg-background px-1 py-[3px] font-mono text-report-label whitespace-nowrap tabular-nums',
              TEXT[edge.tone],
            )}
            style={{ left: edge.left, top: edge.top }}
          >
            {edge.text}
          </motion.span>
        ))}
        {textLabels.map((label) => (
          <motion.span
            key={label.key}
            aria-hidden="true"
            initial={fade}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'pointer-events-none absolute bg-background px-1 py-[3px] font-mono text-report-label whitespace-nowrap tabular-nums',
              TEXT[label.tone],
            )}
            style={{ left: label.left, top: label.top }}
          >
            {label.text}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
