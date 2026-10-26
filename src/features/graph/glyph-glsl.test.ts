import { expect, it } from 'vitest';

import { distanceSource } from './glyph-glsl';
import { glyphOf, GLYPHS } from './glyphs';

it('writes a distance function for every glyph', () => {
  for (const glyph of Object.values(GLYPHS)) {
    expect(distanceSource(glyph)).toMatch(/^float glyph\(vec2 p\)/);
  }
});

it('joins the parts of a glyph with a union', () => {
  const bank = glyphOf('bank');
  expect(bank.polygons).toHaveLength(2);
  expect(distanceSource(bank)).toContain('return min(r0, r1);');
});
