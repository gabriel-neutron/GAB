import { describe, expect, it } from 'vitest';

import { groundPaint } from './basemap';
import { hasGlyph } from './glyph-image';
import { familyOfLink } from './map-tokens';

describe('groundPaint', () => {
  it('draws the plan in greyscale and puts its land on the grey of the token', () => {
    const dark = groundPaint('plan', '#181716');
    const light = groundPaint('plan', '#e6e3e0');
    expect(dark['raster-saturation']).toBe(-1);
    expect(dark['raster-brightness-max']).toBeLessThan(light['raster-brightness-max']);
  });

  it('shows imagery in greyscale at 60%', () => {
    const paint = groundPaint('imagery', '#181716');
    expect(paint['raster-saturation']).toBe(-1);
    expect(paint['raster-opacity']).toBe(0.6);
  });
});

describe('glyphs and families', () => {
  it('has a glyph for each seeded type and none for a stranger', () => {
    expect(hasGlyph('vessel')).toBe(true);
    expect(hasGlyph('military_unit')).toBe(true);
    expect(hasGlyph('spaceship')).toBe(false);
  });

  it('reads a ship-to-ship transfer as the transfer family and a stranger as other', () => {
    expect(familyOfLink('sts_with')).toBe('transfer');
    expect(familyOfLink('unheard_of')).toBe('other');
  });
});
