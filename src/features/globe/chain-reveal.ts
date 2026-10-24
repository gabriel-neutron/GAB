import type { ChainStep } from '@gab/proposal/chain-steps';

/** The identifiers of a step, by the source that holds them. */
export interface StepIds {
  readonly assets: readonly string[];
  readonly arcs: readonly string[];
  readonly exits: readonly string[];
}

/** What the globe shows while a step is in view. */
export interface Reveal {
  /** The steps before this one: drawn in full. */
  readonly done: StepIds;
  /** The step in view: it comes in. */
  readonly entering: StepIds;
  /** The steps after this one: out of sight until their turn. */
  readonly hidden: StepIds;
}

const idsOf = (steps: readonly ChainStep[]): StepIds => ({
  assets: steps.flatMap((one) => one.assets),
  arcs: steps.flatMap((one) => one.arcs),
  exits: steps.flatMap((one) => one.exits),
});

/** The reveal of a step, or null when no step is in view and the globe shows everything. Each
 * feature of `all` that no step up to this one holds stays out of sight: a link in review or an
 * asset with no stage is not part of the story. */
export const revealOf = (
  steps: readonly ChainStep[],
  key: string | null,
  all: StepIds,
): Reveal | null => {
  const at = steps.findIndex((one) => one.key === key);
  const step = steps[at];
  if (step === undefined) return null;
  const done = idsOf(steps.slice(0, at));
  const entering = idsOf([step]);
  const shown = (kind: keyof StepIds): Set<string> => new Set([...done[kind], ...entering[kind]]);
  const unseen = (kind: keyof StepIds): string[] => {
    const seen = shown(kind);
    return all[kind].filter((id) => !seen.has(id));
  };
  return {
    done,
    entering,
    hidden: { assets: unseen('assets'), arcs: unseen('arcs'), exits: unseen('exits') },
  };
};

/** The progress (0 to 1) of the feature at `rank` of `count`, when the whole group is at
 * `progress`. The features start one after the other over `spread` of the time, and each takes
 * the rest of it. */
export const waveProgress = (
  progress: number,
  rank: number,
  count: number,
  spread: number,
): number => {
  const start = count <= 1 ? 0 : (rank / (count - 1)) * spread;
  return Math.min(Math.max((progress - start) / (1 - spread), 0), 1);
};
