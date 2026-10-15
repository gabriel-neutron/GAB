import { ASSET_KINDS } from '@gab/proposal/mapping';

/** The stage of the hydrocarbon chain that an entity with a position belongs to. */
export const STAGES = [
  { key: 'field', label: 'Fields', colour: '#2f7d4f' },
  { key: 'transport', label: 'Upstream transport', colour: '#b8860b' },
  { key: 'processing', label: 'Refining and liquefaction', colour: '#c2571a' },
  { key: 'export', label: 'Export', colour: '#0b6aa2' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];

/** The colour of an entity that has no stage. */
export const NO_STAGE_COLOUR = '#6b7075';

const STAGE_OF_KIND: Readonly<Record<(typeof ASSET_KINDS)[number], StageKey>> = {
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
