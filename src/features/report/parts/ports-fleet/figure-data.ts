import portsRaw from '../../data/ports.csv?raw';
import figures from '../../data/publication-figures.json';
import { readCsv } from '../../line-panel';

export interface Flow {
  readonly panel: string;
  readonly from: string;
  readonly to: string;
  /** Null when the source documents no value. */
  readonly value: number | null;
  readonly unit: string;
  readonly state: string;
}

export interface Lane {
  readonly name: string;
  /** The last day of the data read, counted from the designation. */
  readonly end: number;
  readonly identities: readonly {
    readonly from: number;
    readonly to: number;
    readonly flag: string;
  }[];
  /** R: Russian port, O: other port, E: port of the EU. */
  readonly calls: readonly { readonly day: number; readonly flag: string; readonly kind: string }[];
  readonly flagChanges: readonly number[];
}

const f8 = figures.f8;
const ports = readCsv(portsRaw).filter((row) => row['panel'] === 'a' && row['unit'] === 'Mt');
const lastYear = Math.max(...ports.map((row) => Number(row['period'])));

/** The data of figures 6, 7 and 8 of the PDF, read once and typed: one job, the figure data of the
 * part on ports and the fleet. */
export const figureData = {
  /** 6a: traffic of each port, index 2021 = 100, by year. */
  traffic: figures.f6a.map((series) => ({
    name: series.k,
    points: series.v.map(([year = 0, value = 0]) => ({ year, value })),
  })),
  /** 6b: change of January-April 2026 against January-April 2025, in %. */
  change: figures.f6b.map(([name, value]) => ({ name: String(name), value: Number(value) })),
  /** 6a: all-cargo traffic of each port in the last year of the data, in million tonnes. */
  throughput: {
    year: lastYear,
    ports: ports
      .filter((row) => Number(row['period']) === lastYear)
      .map((row) => ({ name: row['series'] ?? '', value: Number(row['value']) })),
  },
  /** 6c: seaborne crude by fleet category, kb/d, by month. */
  fleet: figures.f6c.map((series) => ({
    key: series.k,
    points: series.v.map(([month, value]) => ({ month: String(month), value: Number(value) })),
  })),
  flows: figures.f7.map((row): Flow => ({
    panel: row.p,
    from: row.f,
    to: row.t,
    value: row.v,
    unit: row.u,
    state: row.s,
  })),
  lives: {
    before: f8.pre,
    after: f8.post,
    census: f8.census,
    groups: f8.groups.map((group) => ({
      name: group.g,
      lanes: group.lanes.map((lane): Lane => ({
        name: lane.n,
        end: lane.end,
        identities: lane.ids.map(([from, to, flag]) => ({
          from: Number(from),
          to: Number(to),
          flag: String(flag),
        })),
        calls: lane.calls.map(([day, flag, kind]) => ({
          day: Number(day),
          flag: String(flag),
          kind: String(kind),
        })),
        flagChanges: lane.chg,
      })),
    })),
  },
};
