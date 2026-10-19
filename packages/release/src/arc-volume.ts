import type { SiteVolume } from './site-release.ts';

// A flow is what the link carries, so it comes before a capacity. An observed figure comes before
// an estimate.
const RANK: Readonly<Record<SiteVolume['volumeClass'], number>> = {
  observed: 0,
  estimated: 1,
  capacity: 2,
};

/** The volume that the map draws for a link, from all its rows: a flow before a capacity, an
 * observed flow before an estimate, then the latest period, then the first row of the table. The
 * other rows stay for the card. Two rows are never added. */
export const drawnVolume = (volumes: readonly SiteVolume[]): SiteVolume | null =>
  volumes.reduce<SiteVolume | null>((best, one) => {
    if (best === null) return one;
    const byClass = RANK[one.volumeClass] - RANK[best.volumeClass];
    if (byClass !== 0) return byClass < 0 ? one : best;
    // The release reads each period as YYYY-MM, so the larger text is the later period.
    return one.period > best.period ? one : best;
  }, null);
