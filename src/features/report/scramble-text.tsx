import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useInView } from 'motion/react';
import { useReduceMotion } from './reduced-motion';

const GLYPHS = '#$%&*+-/<=>?@[]^_{|}~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DURATION_MS = 450;

const glyph = (seed: number): string => GLYPHS.charAt(seed % GLYPHS.length);
// A fixed scramble for the first paint: a render stays pure, and the random glyphs start in the
// first frame of the animation.
const still = (text: string): string =>
  text.replace(/\S/g, (_char, index: number) => glyph(index * 7 + 3));

const noSubscription = () => () => undefined;

/** A short text that resolves from random ASCII glyphs to its words when it enters the view.
 * The words sit in the page from the start, for a screen reader and for the render at the
 * release. Under reduced motion they show at once. */
export function ScrambleText({ text }: { readonly text: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const overlay = useRef<HTMLSpanElement>(null);
  const seen = useInView(box, { once: true, amount: 0.5 });
  const reduce = useReduceMotion();
  const client = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [done, setDone] = useState(false);
  const active = client && !reduce && !done;

  // An adapter: the animation frames of the browser write the glyphs past React.
  useEffect(() => {
    if (!active || !seen) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const fixed = Math.floor(progress * text.length);
      let shown = text.slice(0, fixed);
      for (let index = fixed; index < text.length; index++)
        shown += text[index] === ' ' ? ' ' : glyph(Math.floor(Math.random() * GLYPHS.length));
      if (overlay.current !== null) overlay.current.textContent = shown;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, seen, text]);

  return (
    <span ref={box} className="relative block">
      <span style={{ opacity: active ? 0 : 1 }}>{text}</span>
      {active ? (
        <span ref={overlay} aria-hidden="true" className="absolute inset-0 overflow-hidden">
          {still(text)}
        </span>
      ) : null}
    </span>
  );
}
