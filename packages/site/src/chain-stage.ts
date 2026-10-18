import { ASSET_KINDS } from '@gab/proposal/mapping';

// External constraint: MapLibre parses no oklch colour and no CSS custom property, so each hue of
// a stage, and the grey of no stage, is in hex. The map draws on a dark ground, so each hue is a
// light one. The strip of the page is dark too and takes the same hex, so it matches the points.
/** The six stages of the hydrocarbon chain. An asset kind gives one of the first four. The exit
 * points and the declared destinations come from the physical links and the vessel relations. */
export const STAGES = [
  { key: 'field', label: 'Fields', colour: '#4cc27a' },
  { key: 'transport', label: 'Upstream transport', colour: '#e0c341' },
  { key: 'processing', label: 'Refining and liquefaction', colour: '#ff8a3d' },
  { key: 'export', label: 'Export', colour: '#4aa8ff' },
  { key: 'exit', label: 'Exit from Russian control', colour: '#ff4d6d' },
  { key: 'destination', label: 'Declared destination', colour: '#a58bff' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];

/** The colour of an entity that has no stage. */
export const NO_STAGE_COLOUR = '#8a929a';

const STAGE_OF_KIND: Readonly<
  Record<(typeof ASSET_KINDS)[number], 'field' | 'transport' | 'processing' | 'export'>
> = {
  field: 'field',
  pipeline_segment: 'transport',
  refinery: 'processing',
  lng_plant: 'processing',
  export_terminal: 'export',
};

/** The stage of an entity, from its asset kind. A port that has no asset kind is an export stage.
 * An entity of another type has no stage. */
export const stageOf = (type: string, assetKind: string | undefined): StageKey | null => {
  const kind = ASSET_KINDS.find((one) => one === assetKind);
  if (kind !== undefined) return STAGE_OF_KIND[kind];
  return type === 'port' ? 'export' : null;
};
