import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useInView } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { layout } from './layout';
import { useReduceMotion } from '../reduced-motion';

interface StickySceneProps {
  /** The text cards, in reading order. */
  readonly steps: readonly ReactNode[];
  /** The figure for the step in view. */
  readonly children: (activeStep: number) => ReactNode;
  /** Classes for the sticky figure layer, for example to put it over the cards. */
  readonly sceneClassName?: string | undefined;
  /** Classes that replace the default card box of each step. */
  readonly stepClassName?: string | undefined;
  /** False ends the scene with the last card, with no empty view after it. True by default. */
  readonly tail?: boolean | undefined;
}

/** A scroll scene: the figure stays fixed in the view, the text cards scroll over it, and the card
 * at the middle of the view sets the step of the figure. Under reduced motion, each card shows
 * beside the figure in its own step, with no scroll effect. */
export function StickyScene({
  steps,
  children,
  sceneClassName,
  stepClassName,
  tail = true,
}: StickySceneProps) {
  const reduce = useReduceMotion();
  const [active, setActive] = useState(0);
  // The steps are positional report text with no identity of their own, so their place is their key.
  if (reduce)
    return (
      <div>
        {steps.map((step, index) => (
          <div
            key={`step-${String(index)}`}
            className="grid gap-6 border-t border-border py-8 lg:grid-cols-12 lg:gap-8"
          >
            <div className="min-w-0 lg:col-span-8">{children(index)}</div>
            <div className="min-w-0 text-report-small lg:col-span-4">{step}</div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="relative">
      {/* Safe centre: a figure taller than the view starts at the top and never covers the text above. */}
      <div className={cn('sticky flex items-center-safe', layout.top, layout.view, sceneClassName)}>
        <div className="w-full min-w-0">{children(active)}</div>
      </div>
      <div className="pointer-events-none relative -mt-[var(--report-view,100svh)]">
        {steps.map((step, index) => (
          <SceneStep
            key={`step-${String(index)}`}
            index={index}
            onEnter={setActive}
            className={stepClassName}
          >
            {step}
          </SceneStep>
        ))}
        {tail ? <div className={layout.view} /> : null}
      </div>
    </div>
  );
}

interface SceneStepProps {
  readonly index: number;
  readonly onEnter: (index: number) => void;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

function SceneStep({ index, onEnter, className, children }: SceneStepProps) {
  const slot = useRef<HTMLDivElement>(null);
  // In view while the slot of the card covers the middle line of the view. The slots touch, so a
  // fast scroll cannot jump over the line.
  const inView = useInView(slot, { margin: '-50% 0px -50% 0px' });
  // A subscription: the observer of the view reports the step to the scene.
  useEffect(() => {
    if (inView) onEnter(index);
  }, [inView, index, onEnter]);
  return (
    <div ref={slot} className="flex min-h-[80svh] items-center">
      <div
        className={cn(
          'pointer-events-auto',
          className ?? 'max-w-sm border border-border bg-background p-5 text-report-small',
        )}
      >
        {children}
      </div>
    </div>
  );
}
