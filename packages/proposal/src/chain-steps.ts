import type { ChainFlows } from './chain-flows.ts';
import type { StageKey } from './chain-stage.ts';

/** One step of the story of the chain: what the map puts forward, its count and one sentence. */
export interface ChainStep {
  readonly key: string;
  readonly label: string;
  /** The stage whose colour marks the step in the strip. */
  readonly stage: StageKey;
  readonly count: number;
  readonly sentence: string;
  readonly assets: readonly string[];
  readonly arcs: readonly string[];
  readonly exits: readonly string[];
}

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** The six steps of the chain, from the well to the exit from Russian control. A step counts
 * accepted facts only. A link in review stays on the map in its own style, but no step puts it
 * forward. "Export" is the leg after the terminal: the links after the export stage and the
 * declared destinations. */
export const chainSteps = (flows: ChainFlows): readonly ChainStep[] => {
  const assetsOf = (...stages: readonly StageKey[]): string[] =>
    [...flows.stages].flatMap(([id, stage]) =>
      stage !== null && stages.includes(stage) ? [id] : [],
    );
  const accepted = flows.arcs.filter((one) => !one.inReview);
  const before = accepted.filter((one) => !one.afterExport).map((one) => one.id);
  const after = accepted.filter((one) => one.afterExport).map((one) => one.id);
  const fields = assetsOf('field');
  const plants = assetsOf('processing');
  const terminals = assetsOf('export');
  const acceptedExits = flows.exits.filter((one) => !one.inReview);
  const exits = acceptedExits.map((one) => one.id);
  const unplaced = acceptedExits.filter((one) => one.position === null).length;
  return [
    {
      key: 'extraction',
      label: 'Extraction',
      stage: 'field',
      count: fields.length,
      sentence: `${count(fields.length, 'field has', 'fields have')} a position.`,
      assets: fields,
      arcs: [],
      exits: [],
    },
    {
      key: 'pipeline',
      label: 'Pipeline',
      stage: 'transport',
      count: before.length,
      sentence: `${count(before.length, 'physical link carries', 'physical links carry')} the product before the export stage.`,
      assets: assetsOf('transport'),
      arcs: before,
      exits: [],
    },
    {
      key: 'refinery',
      label: 'Refinery',
      stage: 'processing',
      count: plants.length,
      sentence: `${count(plants.length, 'refinery or LNG plant has', 'refineries and LNG plants have')} a position.`,
      assets: plants,
      arcs: [],
      exits: [],
    },
    {
      key: 'terminal',
      label: 'Terminal',
      stage: 'export',
      count: terminals.length,
      sentence: `${count(terminals.length, 'export terminal or port has', 'export terminals and ports have')} a position.`,
      assets: terminals,
      arcs: [],
      exits: [],
    },
    {
      key: 'export',
      label: 'Export',
      stage: 'destination',
      count: after.length,
      sentence: `${count(after.length, 'physical link goes', 'physical links go')} on after the export stage. ${count(assetsOf('destination').length, 'declared destination has', 'declared destinations have')} a position: the far end of a link from Russia, or a place abroad where a vessel that loads in Russia discharges.`,
      assets: assetsOf('destination'),
      arcs: after,
      exits: [],
    },
    {
      key: 'exit',
      label: 'Exit',
      stage: 'exit',
      count: exits.length,
      sentence: `${count(exits.length, 'exit point', 'exit points')} from Russian control. The release computes each one from its relations: a sale at a Russian port, a ship-to-ship transfer or a handover at the border.${unplaced > 0 ? ` ${count(unplaced, 'exit point has', 'of them have')} no position and ${unplaced === 1 ? 'is' : 'are'} not on the map.` : ''}`,
      assets: [],
      arcs: [],
      exits,
    },
  ];
};
