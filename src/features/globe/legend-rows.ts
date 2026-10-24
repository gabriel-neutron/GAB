import { NO_STAGE_COLOUR, STAGES, type StageKey } from '@gab/proposal/chain-stage';

/** A stage of the legend: its colour, its words and how many points of the map it holds. */
export interface StageRow {
  readonly key: StageKey | 'none';
  readonly label: string;
  readonly colour: string;
  readonly count: number;
}

/** The stages of the chain in their order, then the grey of an entity with no stage. The count of
 * each row is read from the points the canvas draws, so the legend and the map agree. */
export const stageRows = (stageKeys: readonly unknown[]): readonly StageRow[] => {
  const tally = new Map<unknown, number>();
  for (const key of stageKeys) tally.set(key, (tally.get(key) ?? 0) + 1);
  return [
    ...STAGES.map((one) => ({ ...one, count: tally.get(one.key) ?? 0 })),
    {
      key: 'none' as const,
      label: 'No stage',
      colour: NO_STAGE_COLOUR,
      count: [...tally].reduce(
        (sum, [key, count]) => (STAGES.some((one) => one.key === key) ? sum : sum + count),
        0,
      ),
    },
  ];
};
