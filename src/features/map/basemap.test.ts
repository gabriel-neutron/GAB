import { describe, expect, it } from 'vitest';

import { backgroundOf, imageryPaint, PLAN_GROUND_LAYERS, planColours, planLayers } from './basemap';
import { hasGlyph } from './glyph-image';
import { familyOfLink, type MapTokens } from './map-tokens';

const tokens = (water: string, land: string): MapTokens => ({
  water,
  casing: water,
  land,
  boundary: '#777777',
  label: '#999999',
  ring: '#ffffff',
  signal: '#ff0000',
  muted: '#888888',
  family: {
    ownership: '#111111',
    designation: '#222222',
    operation: '#333333',
    transfer: '#444444',
    other: '#555555',
  },
});
const dark = tokens('#0c0b0a', '#181716');
const light = tokens('#cfcdca', '#e6e3e0');

describe('planLayers', () => {
  const layers = planLayers(dark, 'plan');

  it('reads only water, boundaries, sea names and place names from the tiles', () => {
    const read = new Set(
      layers.flatMap((one) => ('source-layer' in one ? [one['source-layer']] : [])),
    );
    expect([...read].sort()).toEqual(['boundary', 'place', 'water', 'water_name']);
  });

  it('keeps places to countries, cities and towns, and never a point of interest', () => {
    const filters = layers
      .filter((one) => 'source-layer' in one && one['source-layer'] === 'place')
      .map((one) => JSON.stringify('filter' in one ? one.filter : null));
    expect(filters).toHaveLength(3);
    for (const one of ['country', 'city', 'town']) {
      expect(filters.some((filter) => filter.includes(`"${one}"`))).toBe(true);
    }
  });

  it('draws the names in Geist and the sea names in the mono caption style', () => {
    const font = (id: string): unknown => {
      const layer = layers.find((one) => one.id === id);
      return layer !== undefined && 'layout' in layer
        ? (layer.layout as Record<string, unknown> | undefined)?.['text-font']
        : null;
    };
    expect(font('plan-name-city')).toEqual(['Geist']);
    expect(font('plan-sea-name')).toEqual(['GeistMono']);
  });

  it('puts the land in the background and takes every colour from the tokens', () => {
    expect(layers[0]).toMatchObject({ id: 'background', paint: { 'background-color': dark.land } });
    const coloured = planColours(dark, 'plan');
    expect(coloured.find(([id]) => id === 'plan-water')?.[2]).toBe(dark.water);
    expect(coloured.every(([, , value]) => value !== light.land && value !== light.water)).toBe(
      true,
    );
  });

  it('paints the light theme with the light tokens', () => {
    const background = planColours(light, 'plan').find(([id]) => id === 'background');
    expect(background?.[2]).toBe(light.land);
  });

  it('hides the water and the coast under imagery and puts the water behind it', () => {
    const under = planLayers(dark, 'imagery');
    for (const id of PLAN_GROUND_LAYERS) {
      expect(under.find((one) => one.id === id)).toMatchObject({ layout: { visibility: 'none' } });
    }
    expect(backgroundOf('imagery', dark)).toBe(dark.water);
  });
});

describe('imageryPaint', () => {
  it('shows imagery in greyscale at 60%', () => {
    const paint = imageryPaint();
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
