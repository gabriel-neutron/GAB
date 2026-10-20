import { describe, expect, it } from 'vitest';

import { isShown } from './type-filter';

const ring = { entityType: 'vessel', unplaced: true };
const placed = { entityType: 'vessel', unplaced: false };

describe('what the canvas draws', () => {
  it('draws a node on the ring while the switch is on', () => {
    expect(isShown(ring, new Set(), true)).toBe(true);
  });

  it('leaves out a node on the ring when the switch is off, so it cannot be selected or centred', () => {
    expect(isShown(ring, new Set(), false)).toBe(false);
  });

  it('keeps a placed node when the switch is off', () => {
    expect(isShown(placed, new Set(), false)).toBe(true);
  });

  it('leaves out a node whose type is switched off, whatever the switch for the ring says', () => {
    expect(isShown(placed, new Set(['vessel']), true)).toBe(false);
  });
});
