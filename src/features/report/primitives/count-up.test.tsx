import { MotionConfig } from 'motion/react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountUp } from './count-up';

const format = (value: number) => `${String(Math.round(value))}%`;
// The visible text of the count, without the box that holds the final width.
const counted = (html: string) => /<span class="\[grid-area:1\/1\]"[^>]*>([^<]*)</.exec(html)?.[1];

describe('CountUp', () => {
  it('gives the final value to the screen reader and holds its width before the count', () => {
    const html = renderToStaticMarkup(<CountUp value={84} format={format} />);
    expect(html).toContain('<span class="sr-only">84%</span>');
    expect(html).toContain('<span class="invisible [grid-area:1/1]">84%</span>');
  });

  // The release HTML shows its values before any script runs, and the hydration of that HTML
  // gives the same text: the release render is a still render, with or without reduced motion.
  it('draws the final value in the release render, also under reduced motion', () => {
    for (const reducedMotion of ['never', 'always'] as const) {
      const html = renderToString(
        <MotionConfig reducedMotion={reducedMotion}>
          <CountUp value={84} format={format} />
        </MotionConfig>,
      );
      expect(counted(html)).toBe('84%');
    }
  });
});
