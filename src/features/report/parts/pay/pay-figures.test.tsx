import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { payUi } from '../../content';
import { BuyersChart } from './pay-figures';

describe('BuyersChart', () => {
  it('has a native year slider over the years of the data, at the last year', () => {
    const html = renderToStaticMarkup(<BuyersChart />);
    // A native range input: the arrow keys move it and a screen reader says its value.
    const slider = /<input type="range"[^>]*>/.exec(html)?.[0] ?? '';
    expect(slider).toContain(`aria-label="${payUi.year}"`);
    expect(slider).toContain('min="2020"');
    expect(slider).toContain('max="2025"');
    expect(slider).toContain('value="2025"');
  });
});
