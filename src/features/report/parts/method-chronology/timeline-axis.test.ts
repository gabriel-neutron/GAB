import { describe, expect, it } from 'vitest';
import { en } from '../../content';
import { fr } from '../../content-fr';
import { cursorAt, shiftFor, stepAt, TRACK, xOf } from './timeline-axis';

describe.each([
  ['en', en],
  ['fr', fr],
])('the scroll of the %s time axis', (_, copy) => {
  const dates = copy.figureTexts.fig2.events.map((event) => event.date);

  it.each([390, 1024, 1440])('selects each event at its scroll place, %ipx wide', (view) => {
    for (const date of dates) {
      // The slider scrolls one px past the shift of the event. Two events of one day: the scroll
      // selects the last one.
      const x = cursorAt(shiftFor(xOf(date), view) + 1, view);
      expect(stepAt(dates, x)).toBe(dates.lastIndexOf(date));
    }
  });

  it('meets the start of the axis at no scroll and its end at the last shift', () => {
    expect(cursorAt(0, 1440)).toBe(0);
    expect(cursorAt(TRACK - 1440, 1440)).toBeCloseTo(TRACK);
    expect(stepAt(dates, 0)).toBe(0);
    expect(stepAt(dates, TRACK)).toBe(dates.length - 1);
  });
});
