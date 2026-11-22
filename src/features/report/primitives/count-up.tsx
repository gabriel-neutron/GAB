import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useReduceMotion } from '../reduced-motion';
import { useReleaseRender } from '../release-render';

interface CountUpProps {
  readonly value: number;
  readonly format: (value: number) => string;
}

/** A value that counts up from zero once, when it enters the view. The screen reader reads only
 * the final value. Under reduced motion, and on the release page, the final value shows at once:
 * the release HTML shows its values before any script runs. */
export function CountUp({ value, format }: CountUpProps) {
  const reduce = useReduceMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const still = useReleaseRender() || reduce;
  const shown = useMotionValue(still ? value : 0);
  const text = useTransform(shown, format);
  // A subscription to the view: the count starts once, on entry.
  useEffect(() => {
    if (still) {
      shown.set(value);
      return undefined;
    }
    if (!inView) return undefined;
    const run = animate(shown, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return () => {
      run.stop();
    };
  }, [inView, still, shown, value]);
  return (
    <>
      {/* The final value holds the box in the same cell, so the count shifts no layout. */}
      <span ref={ref} aria-hidden="true" className="inline-grid">
        <span className="invisible [grid-area:1/1]">{format(value)}</span>
        <motion.span className="[grid-area:1/1]">{text}</motion.span>
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
