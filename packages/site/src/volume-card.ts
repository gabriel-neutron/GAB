import { safeHref } from './safe-href.ts';
import type { SiteVolume } from './site-release.ts';

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

/** The lines of the card of a link: one for each volume, with its value, its range, its period,
 * its class and its source document. */
export const volumeCard = (volumes: readonly SiteVolume[]): readonly VolumeLine[] =>
  volumes.map((one) => {
    const amount = (value: number): string => `${String(value)} ${one.unit}`;
    const range =
      one.minimum === null || one.maximum === null
        ? ''
        : `, from ${String(one.minimum)} to ${amount(one.maximum)}`;
    const capacity = one.volumeClass === 'capacity' ? ' A nominal capacity, not a flow.' : '';
    const note = one.note === '' ? '' : ` Note: ${one.note}.`;
    const page = one.page === '' ? '' : `, page ${one.page}`;
    return {
      text: `${CLASS_WORDS[one.volumeClass]}: ${amount(one.value)}${range}, period ${one.period}.${capacity}${note}`,
      source: `Source: ${one.documentTitle}${page}.`,
      href: one.documentAddress === null ? null : safeHref(one.documentAddress),
    };
  });
