import wavesRaw from '../../data/fleet-waves.csv?raw';
import { readCsv } from '../../line-panel';

/** The regimes of the counters, in the order of the fleet-waves figure. */
export const REGIMES = ['EU', 'UK', 'OFAC'] as const;
type Regime = (typeof REGIMES)[number];

const quarters = readCsv(wavesRaw).filter((row) => row['kind'] === 'quarter');

/** The tankers designated by each regime to the end of the quarter of `date` (YYYY-MM-DD). The
 * data gives one count for each quarter, so a date counts its whole quarter. */
export function countsAt(date: string): Readonly<Record<Regime, number>> {
  const quarter = `${date.slice(0, 4)}-Q${String(Math.ceil(Number(date.slice(5, 7)) / 3))}`;
  const total = (regime: Regime) =>
    quarters
      .filter((row) => row['regime'] === regime && (row['key'] ?? '') <= quarter)
      .reduce((sum, row) => sum + Number(row['value']), 0);
  return { EU: total('EU'), UK: total('UK'), OFAC: total('OFAC') };
}
