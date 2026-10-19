import { STAGES } from '@gab/proposal/chain-stage';
import type { ChainStep } from '@gab/proposal/chain-steps';

import { cn } from '@/shared/lib/utils';

import { CONTROL } from './control-class';
import type { GlobeStore } from './globe-store';
import { useGlobeState } from './use-globe-state';

export interface ChainStepsProps {
  readonly store: GlobeStore;
  readonly steps: readonly ChainStep[];
}

const STEP_CONTROL = cn(CONTROL, 'w-full text-left');

/** The six steps of the chain, from the well to the exit from Russian control, with their counts,
 * the sentence of the step in view, and the controls that go through the steps. */
export function ChainSteps({ store, steps }: ChainStepsProps) {
  const { step, playing, moving, available } = useGlobeState(store);
  if (!available) return null;
  const shown = steps.find((one) => one.key === step);
  return (
    <div className="flex flex-col gap-1 border-t border-border p-1">
      <div className="flex flex-wrap gap-1">
        {/* With no motion, a press goes to the next step and nothing moves by itself. */}
        <button
          type="button"
          className={CONTROL}
          onClick={() => {
            store.togglePlay();
          }}
        >
          {!moving ? 'Next step' : playing ? 'Pause' : 'Play the chain'}
        </button>
        <button
          type="button"
          className={CONTROL}
          aria-pressed={!moving}
          disabled={!moving}
          onClick={() => {
            store.stopMotion();
          }}
        >
          Stop motion
        </button>
      </div>
      <ol
        aria-label="Steps of the chain"
        className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6"
      >
        {steps.map((one) => (
          <li key={one.key}>
            <button
              type="button"
              className={STEP_CONTROL}
              aria-pressed={step === one.key}
              onClick={() => {
                store.setStep(step === one.key ? null : one.key);
              }}
            >
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 rounded-full"
                // External constraint: the hue of a stage is a hex that the canvas shares.
                style={{ backgroundColor: STAGES.find((stage) => stage.key === one.stage)?.colour }}
              />
              <span className="min-w-0">
                {one.label}: <span className="font-mono tabular-nums">{one.count}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {/* The region stands at all times, so a screen reader announces each new sentence. Empty,
          it is read by a screen reader and takes no room on the screen. */}
      <p role="status" className="max-w-prose text-small/4 empty:sr-only">
        {shown?.sentence}
      </p>
    </div>
  );
}
