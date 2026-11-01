import publication from '../../data/publication-figures.json';

type Pairs = readonly (readonly number[])[];

/** The share, in % of total, of one group of currencies in the exports or the imports of one
 * year. A year with no value gives `undefined`, not a share of zero. */
export const settlementShare = (
  panel: 'exports' | 'imports',
  key: string,
  year: number,
): number | undefined => {
  const pairs = (publication.f9[panel] as Readonly<Record<string, Pairs>>)[key];
  return pairs?.find((pair) => pair[0] === year)?.[1];
};
