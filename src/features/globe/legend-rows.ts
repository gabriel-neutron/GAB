import { NO_STAGE_COLOUR, STAGES } from '@gab/proposal/chain-stage';

/** A point of the legend: one colour and the words for it. */
export interface PointRow {
  readonly key: string;
  readonly label: string;
  readonly colour: string;
}

/** The stages of the chain, then the grey of an entity with no stage. */
export const pointRows = (): readonly PointRow[] => [
  ...STAGES.map((one) => ({ key: one.key, label: one.label, colour: one.colour })),
  { key: 'none', label: 'No stage', colour: NO_STAGE_COLOUR },
];
