import { safeHref } from './safe-href.ts';
import type { SiteVolume } from '@gab/release/site-release';

/** The words of one volume in the card of a link, and its source with a link when its address is
 * safe. */
export interface VolumeLine {
  readonly text: string;
  readonly source: string;
  readonly href: string | null;
}

const CLASS_WORDS: Readonly<Record<SiteVolume['volumeClass'], string>> = {
  observed: 'Observed',
  estimated: 'Estimated',
  capacity: 'Capacity',
};

// The research writes its units in French. The page is in English, so a known unit takes its
// English words. An unknown unit stays as the source gives it.
const ENGLISH_UNITS: ReadonlyMap<string, string> = new Map([
  ['kb/j', 'kb/d'],
  ['kt/mois', 'kt/month'],
  ['mt/an', 'Mt/year'],
  ['gwh/mois', 'GWh/month'],
  ['gm³/an', 'bcm/year'],
  ['gm3/an', 'bcm/year'],
  ['mds m³/an', 'bcm/year'],
]);

const unitWords = (unit: string): string => ENGLISH_UNITS.get(unit.toLowerCase()) ?? unit;

/** The lines of the card of a link: one for each volume, with its value, its range, its period,
 * its class and its source document. Each volume of a link in review is marked in review, so the
 * card never gives it as a fact. */
export const volumeCard = (
  volumes: readonly SiteVolume[],
  inReview: boolean,
): readonly VolumeLine[] =>
  volumes.map((one) => {
    const unit = unitWords(one.unit);
    const amount = (value: number): string => `${String(value)} ${unit}`;
    const range =
      one.minimum === null || one.maximum === null
        ? ''
        : `, from ${String(one.minimum)} to ${amount(one.maximum)}`;
    const capacity = one.volumeClass === 'capacity' ? ' A nominal capacity, not a flow.' : '';
    const note = one.note === '' ? '' : ` Note: ${one.note}.`;
    const page = one.page === '' ? '' : `, page ${one.page}`;
    const review = inReview ? 'In review, not a fact: ' : '';
    return {
      text: `${review}${CLASS_WORDS[one.volumeClass]}: ${amount(one.value)}${range}, period ${one.period}.${capacity}${note}`,
      source: `Source: ${one.documentTitle}${page}.`,
      href: one.documentAddress === null ? null : safeHref(one.documentAddress),
    };
  });
