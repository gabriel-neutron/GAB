import { describe, expect, it } from 'vitest';

import { keyWords, valueHelp } from './key-words';
import { typeLabel } from './type-label';

describe('the label of an entity type', () => {
  it('reads the label of the seed', () => {
    expect(typeLabel('military_unit')).toBe('Military unit');
    expect(typeLabel('state_body')).toBe('State body');
  });

  it('prefers the list that the caller holds', () => {
    const types = [
      { key: 'port', label: 'Harbour', colourLight: '', colourDark: '', retired: false },
    ];
    expect(typeLabel('port', types)).toBe('Harbour');
  });

  it('never shows an underscore for a key that no list holds', () => {
    expect(typeLabel('naval_base')).toBe('Naval base');
  });
});

describe('the words of an attribute key', () => {
  it('gives a label and a help for a known key', () => {
    expect(keyWords('source_urls').label).toBe('Source addresses');
    expect(keyWords('v1_id').help).not.toBeNull();
  });

  it('opens the underscores of any other key and gives no help', () => {
    expect(keyWords('crane_note')).toEqual({ label: 'Crane note', help: null });
  });

  it('explains a word that an attribute states', () => {
    expect(valueHelp('position_precision', 'approximate')).toMatch(/near/);
    expect(valueHelp('position_precision', 'other')).toBeNull();
    expect(valueHelp('note', 'approximate')).toBeNull();
  });
});
