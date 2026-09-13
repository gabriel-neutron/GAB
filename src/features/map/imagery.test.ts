import { describe, expect, it } from 'vitest';

import { describeImagery, imageryGround, isImagery, stepImagery, withKind } from './imagery';

const TODAY = new Date().toISOString().slice(0, 10);

describe('the guard of a stored imagery', () => {
  it('takes a year of the composite and a real day of a daily source', () => {
    expect(isImagery({ kind: 'eox', year: 2016 })).toBe(true);
    expect(isImagery({ kind: 'eox', year: 2025 })).toBe(true);
    expect(isImagery({ kind: 'gibs-s30', day: '2015-11-28' })).toBe(true);
    expect(isImagery({ kind: 'gibs-l30', day: TODAY })).toBe(true);
  });

  it('refuses a year outside the composites, a day outside the source, and a day that is not', () => {
    expect(isImagery({ kind: 'eox', year: 2015 })).toBe(false);
    expect(isImagery({ kind: 'eox', year: 2026 })).toBe(false);
    expect(isImagery({ kind: 'eox', year: 2019.5 })).toBe(false);
    expect(isImagery({ kind: 'gibs-s30', day: '2015-11-27' })).toBe(false);
    expect(isImagery({ kind: 'gibs-l30', day: '2013-03-21' })).toBe(false);
    expect(isImagery({ kind: 'gibs-s30', day: '2999-01-01' })).toBe(false);
    expect(isImagery({ kind: 'gibs-s30', day: '2021-02-30' })).toBe(false);
    expect(isImagery({ kind: 'gibs-s30', day: '2021-2-3' })).toBe(false);
    expect(isImagery({ kind: 'bing', day: '2021-02-03' })).toBe(false);
    expect(isImagery(null)).toBe(false);
  });
});

describe('a step of one unit', () => {
  it('stops at both bounds of the composite', () => {
    const last = { kind: 'eox', year: 2025 } as const;
    const first = { kind: 'eox', year: 2016 } as const;
    expect(stepImagery(last, 1)).toBe(last);
    expect(stepImagery(first, -1)).toBe(first);
    expect(stepImagery(last, -1)).toEqual({ kind: 'eox', year: 2024 });
  });

  it('crosses a month and a year for a day, and stops at both bounds of the source', () => {
    expect(stepImagery({ kind: 'gibs-s30', day: '2020-02-29' }, 1)).toEqual({
      kind: 'gibs-s30',
      day: '2020-03-01',
    });
    expect(stepImagery({ kind: 'gibs-l30', day: '2020-01-01' }, -1)).toEqual({
      kind: 'gibs-l30',
      day: '2019-12-31',
    });
    const first = { kind: 'gibs-s30', day: '2015-11-28' } as const;
    const today = { kind: 'gibs-l30', day: TODAY } as const;
    expect(stepImagery(first, -1)).toBe(first);
    expect(stepImagery(today, 1)).toBe(today);
  });
});

describe('a change of source', () => {
  it('carries a year over as the middle of that year', () => {
    expect(withKind({ kind: 'eox', year: 2019 }, 'gibs-l30')).toEqual({
      kind: 'gibs-l30',
      day: '2019-07-01',
    });
  });

  it('carries a day over as its year, and clamps into the composites', () => {
    expect(withKind({ kind: 'gibs-s30', day: '2021-04-09' }, 'eox')).toEqual({
      kind: 'eox',
      year: 2021,
    });
    expect(withKind({ kind: 'gibs-l30', day: '2013-04-09' }, 'eox')).toEqual({
      kind: 'eox',
      year: 2016,
    });
  });

  it('clamps a day into the bounds of the new daily source', () => {
    expect(withKind({ kind: 'gibs-l30', day: '2014-06-01' }, 'gibs-s30')).toEqual({
      kind: 'gibs-s30',
      day: '2015-11-28',
    });
  });
});

describe('the ground a source builds', () => {
  it('credits the 2018 composite with both of its years', () => {
    const ground = imageryGround({ kind: 'eox', year: 2018 });
    expect(ground.attribution).toContain(
      '(Contains modified Copernicus Sentinel data 2017 & 2018)',
    );
    expect(ground.tiles).toContain('s2cloudless-2018_3857');
    expect(ground.maxZoom).toBe(14);
  });

  it('asks the daily source for its day at the level it answers', () => {
    const ground = imageryGround({ kind: 'gibs-s30', day: '2026-08-20' });
    expect(ground.tiles).toContain('/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/2026-08-20/');
    expect(ground.tiles).toContain('GoogleMapsCompatible_Level12/{z}/{y}/{x}.png');
    expect(ground.maxZoom).toBe(12);
  });
});

describe('the words of a selection', () => {
  it('carry the whole credit, and the credit of 2018 names both years', () => {
    expect(describeImagery({ kind: 'eox', year: 2018 }).credit).toContain('2017 & 2018');
    expect(describeImagery({ kind: 'gibs-l30', day: '2020-05-04' }).credit).toContain(
      "NASA's Global Imagery Browse Services",
    );
  });
});
