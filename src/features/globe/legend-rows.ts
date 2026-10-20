import { NO_STAGE_COLOUR, STAGES } from '@gab/proposal/chain-stage';

import type { ArcLine } from '@gab/release/arc-line';

import { ARC_LAYERS } from './arc-layers';

/** A point of the legend: one colour and the words for it. */
export interface PointRow {
  readonly key: string;
  readonly label: string;
  readonly colour: string;
}

/** A line of the legend: the dash pattern of the canvas, null for a full line. */
export interface LineRow {
  readonly style: ArcLine['style'];
  readonly label: string;
  readonly dash: readonly number[] | null;
  /** True when the canvas draws the line in the grey of a fact in review. */
  readonly review: boolean;
  /** True when the canvas draws a line of the land inside the line. */
  readonly hollow: boolean;
}

// The legend has two related exports: the points and the lines of one key.
// One wording for each style of the canvas. A style with no words is a fault that a test finds.
const LINE_WORDS: Readonly<Record<ArcLine['style'], string>> = {
  solid: 'Link with no volume',
  dashed: 'Link after the export stage, with no volume',
  observed: 'Observed flow: the width grows with the value',
  estimated: 'Estimated flow: the pale band is its range',
  capacity: 'Nominal capacity of a pipeline, not a flow',
  'in review': 'Link in review, not a fact',
};

const ORDER: readonly ArcLine['style'][] = [
  'solid',
  'dashed',
  'observed',
  'estimated',
  'capacity',
  'in review',
];

/** The stages of the chain, then the grey of an entity with no stage. */
export const pointRows = (): readonly PointRow[] => [
  ...STAGES.map((one) => ({ key: one.key, label: one.label, colour: one.colour })),
  { key: 'none', label: 'No stage', colour: NO_STAGE_COLOUR },
];

/** One row for each style of line that the canvas draws, read from the layers of the canvas. */
export const lineRows = (): readonly LineRow[] =>
  ORDER.flatMap((style) => {
    const layers = ARC_LAYERS.filter((one) => one.style === style && one.width !== 'halo');
    const main = layers.find((one) => one.width === 'width');
    if (main === undefined) return [];
    return [
      {
        style,
        label: LINE_WORDS[style],
        dash: main.dash,
        review: main.colour === 'review',
        hollow: layers.some((one) => one.colour === 'land'),
      },
    ];
  });
