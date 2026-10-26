import { describe, expect, it, vi } from 'vitest';

import {
  backgroundOf,
  glyphsUrl,
  imageryPaint,
  PLAN_GROUND_LAYERS,
  planColours,
  planLayers,
} from './basemap';
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
    expect(planColours(dark, 'plan').background).toBe(dark.land);
    expect(planColours(light, 'plan').background).toBe(light.land);
    expect(planColours(dark, 'plan').names.find((one) => one.id === 'plan-sea-name')?.halo).toBe(
      dark.water,
    );
  });

  it('orders the layers so the imagery can lie after the coast and before the borders', () => {
    const ids = layers.map((one) => one.id);
    expect(ids.indexOf('plan-coast')).toBe(ids.indexOf('plan-water') + 1);
    expect(ids.indexOf('plan-border-internal')).toBe(ids.indexOf('plan-coast') + 1);
    expect(ids.indexOf('plan-name-city')).toBeGreaterThan(ids.indexOf('plan-border-country'));
  });

  it('draws no maritime border', () => {
    for (const one of layers.filter((layer) => layer.id.startsWith('plan-border-'))) {
      expect(JSON.stringify('filter' in one ? one.filter : null)).toContain('"maritime"');
    }
  });

  it('serves the glyph files from this origin', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    expect(glyphsUrl()).toMatch(/\/map-fonts\/\{fontstack\}\/\{range\}\.pbf$/);
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
