import { MotionConfig } from 'motion/react';
import { renderToStaticMarkup } from 'react-dom/server';
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

  it('shows the final value at once under reduced motion', () => {
    const html = renderToStaticMarkup(
      <MotionConfig reducedMotion="always">
        <CountUp value={84} format={format} />
      </MotionConfig>,
    );
    expect(counted(html)).toBe('84%');
  });
});
