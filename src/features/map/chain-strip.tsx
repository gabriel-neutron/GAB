import type { ChainStep } from '@gab/proposal/chain-steps';
import { STAGES } from '@gab/proposal/chain-stage';

import { cn } from '@/shared/lib/utils';

/** What the reader asks of the chain: the mode, the projection, and one step or none. */
export type ChainAct =
  | { readonly kind: 'switch-chain'; readonly on: boolean }
  | { readonly kind: 'switch-globe'; readonly on: boolean }
  | { readonly kind: 'show-step'; readonly key: string | null };

interface ChainStripProps {
  readonly steps: readonly ChainStep[];
  readonly state: {
    readonly chain: boolean;
    readonly globe: boolean;
    readonly step: string | null;
  };
  readonly onAct: (act: ChainAct) => void;
}

// It floats over a canvas, so `pointer-events-auto` takes the pointer back from it. A state change
// stays under the 120 ms ceiling.
const CONTROL = cn(
  'pointer-events-auto flex h-6 items-center gap-1.5 border border-input bg-popover px-1.5',
  'text-small/4 text-popover-foreground transition-colors duration-100 hover:bg-muted',
  'aria-pressed:bg-foreground aria-pressed:text-background',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** The controls of the chain over the map: the Chain mode, the globe, and in the Chain mode the
 * six steps with their counts and the sentence of the step in view. */
export function ChainStrip({ steps, state, onAct }: ChainStripProps) {
  const shown = steps.find((one) => one.key === state.step);
  return (
    <div className="pointer-events-none absolute bottom-8 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1">
      {/* The region stands while the Chain mode is on, so a screen reader announces each new
        sentence. Empty, it takes no room on the screen. */}
      {state.chain ? (
        <p
          role="status"
          className="pointer-events-auto max-w-prose border border-border bg-popover px-1.5 py-1 text-small/4 text-popover-foreground empty:sr-only"
        >
          {shown?.sentence}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={CONTROL}
          aria-pressed={state.chain}
          onClick={() => {
            onAct({ kind: 'switch-chain', on: !state.chain });
          }}
        >
          Chain
        </button>
        <button
          type="button"
          className={CONTROL}
          aria-pressed={state.globe}
          onClick={() => {
            onAct({ kind: 'switch-globe', on: !state.globe });
          }}
        >
          Globe
        </button>
        {state.chain ? (
          <ol aria-label="Steps of the chain" className="flex flex-wrap gap-1">
            {steps.map((one) => (
              <li key={one.key}>
                <button
                  type="button"
                  className={CONTROL}
                  aria-pressed={state.step === one.key}
                  onClick={() => {
                    onAct({ kind: 'show-step', key: state.step === one.key ? null : one.key });
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    // External constraint: the hue of a stage is a hex that the map shares.
                    style={{
                      backgroundColor: STAGES.find((stage) => stage.key === one.stage)?.colour,
                    }}
                  />
                  {one.label}: <span className="font-mono tabular-nums">{one.count}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
