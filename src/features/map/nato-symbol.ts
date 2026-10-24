import type { Attributes } from '@/shared/read/model';

/** The frame, the echelon mark and the domain mark of one unit, as path data and as words. */
export interface NatoSymbol {
  /** The affiliation frame. Every row of the corpus states `Hostile`, so it is one diamond. */
  readonly frame: string;
  /** The echelon mark, above the frame. Null for an absent word and for an unlisted one. */
  readonly echelon: string | null;
  /** The domain mark, inside the frame. Null for an absent word: a symbol omits what it does
   * not know, and a unit that recorded no domain must never read as a ground unit. */
  readonly domain: string | null;
  /** The echelon and the domain in words, for a reader who reads no military symbol. Null when
   * the attributes carry neither word, because a blank is what an absence looks like. */
  readonly words: string | null;
  /** The whole reading, affiliation included. It is the accessible name of the graphic. */
  readonly name: string;
}

// The box of every path below. It travels with the function because the two are one drawing:
// a caller that framed these paths in another box would draw a mark off its own frame.
export const SYMBOL_BOX = '0 0 24 20';

/** Only a unit carries this symbol. A facility and an organisation are given no frame. */
const UNIT = 'military_unit';

const HOSTILE = 'Hostile';

// The diamond stands in the lower part of the box and leaves a band above it for the echelon.
// The half width is 6.5 and the centre is at 13, so a stroke of 1.2 stays inside the box.
const FRAME = 'M12 6.5L18.5 13L12 19.5L5.5 13Z';

/** The centre of the box across, and the middle of the echelon band down. */
const MIDDLE = 12;
const BAND = 3.5;

const at = (value: number): string => value.toFixed(2);

/** The centre of each glyph of a row of `count`, `gap` apart, centred on the box. */
const row = (count: number, gap: number): readonly number[] =>
  Array.from({ length: count }, (_, index) => MIDDLE + (index - (count - 1) / 2) * gap);

/** A dot, drawn as a circle of radius 0.6 that a stroke of 1.2 fills to a disc of 2.4. */
const dot = (x: number): string =>
  `M${at(x - 0.6)} ${at(BAND)}a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0-1.2 0`;

const bar = (x: number): string => `M${at(x)} 1.3V5.7`;

const cross = (x: number): string =>
  `M${at(x - 1.6)} 1.6L${at(x + 1.6)} 5.4M${at(x + 1.6)} 1.6L${at(x - 1.6)} 5.4`;

const plus = (x: number): string =>
  `M${at(x - 1.6)} ${at(BAND)}H${at(x + 1.6)}M${at(x)} ${at(BAND - 1.6)}V${at(BAND + 1.6)}`;

/** The mark of a team or a crew: an oval crossed by a stroke. */
const oval = (x: number): string =>
  `M${at(x - 2)} ${at(BAND)}a2 2.2 0 1 0 4 0a2 2.2 0 1 0-4 0M${at(x - 1.8)} 5.4L${at(x + 1.8)} 1.6`;

const glyphs = (count: number, gap: number, draw: (x: number) => string): string =>
  row(count, gap)
    .map((x) => draw(x))
    .join('');

// The eleven echelon words the corpus holds, each with the mark that stands for it: a dot, a
// bar, a cross, a pair of crossed strokes, or an oval. A twelfth word finds nothing here.
const ECHELON: Readonly<Record<string, string>> = {
  'Team/Crew': glyphs(1, 0, oval),
  Squad: glyphs(1, 0, dot),
  'Platoon/detachment': glyphs(3, 3, dot),
  'Company/battery/troop': glyphs(1, 0, bar),
  'Battalion/squadron': glyphs(2, 3, bar),
  'Regiment/group': glyphs(3, 3, bar),
  Brigade: glyphs(1, 0, cross),
  Division: glyphs(2, 3.6, cross),
  Army: glyphs(4, 3.6, cross),
  'Region/Theater': glyphs(6, 3.6, cross),
  Command: glyphs(2, 4.2, plus),
};

// The three domain words the corpus holds. The ground line sits inside the diamond; the dome
// stands over it for air, and the dome carries a stroke above it for space.
const DOMAIN: Readonly<Record<string, string>> = {
  Ground: 'M9 14.5H15',
  Air: 'M9 14.5A3 3 0 0 1 15 14.5',
  Space: 'M9 14.5A3 3 0 0 1 15 14.5M9.2 10.9H14.8',
};

/** The word an attribute states, or null. A value that is not a word states nothing here. */
const word = (attrs: Attributes, key: string): string | null => {
  const held = attrs[key]?.v;
  return typeof held === 'string' && held.length > 0 ? held : null;
};

/** The marks one entity draws, or null where it draws none. It reads three attribute keys, and
 * it supplies no value for a key that is absent. */
export function natoSymbol(type: string, attrs: Attributes): NatoSymbol | null {
  if (type !== UNIT) return null;
  // The frame is the affiliation. An entity that records none is given no frame, because a
  // diamond drawn over an absence would state an affiliation that no document carries.
  if (word(attrs, 'affiliation') !== HOSTILE) return null;

  const echelon = word(attrs, 'echelon');
  const domain = word(attrs, 'domain');
  // The words repeat what the attributes recorded, and the marks come from the closed sets
  // above. So a word this file draws no mark for is still readable on the screen.
  const said = [echelon, domain].filter((held) => held !== null);

  return {
    frame: FRAME,
    echelon: echelon === null ? null : (ECHELON[echelon] ?? null),
    domain: domain === null ? null : (DOMAIN[domain] ?? null),
    words: said.length === 0 ? null : said.join(', '),
    name: ['Hostile unit', ...said].join(', '),
  };
}
