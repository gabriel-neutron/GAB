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
    expect(counted(html)).toBe('0%');
  });

  // The client hydrates the release page, so its first render must give the same text as the
  // release render. The final value under reduced motion comes after the hydration.
  it('draws the count from zero in the release render, also under reduced motion', () => {
    const html = renderToString(
      <MotionConfig reducedMotion="always">
        <CountUp value={84} format={format} />
      </MotionConfig>,
    );
    expect(counted(html)).toBe('0%');
  });
});
