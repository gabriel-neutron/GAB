// The three data files of the report for the stories: files with invented values in the columns
// of the real files. The real files are in the site package.

import type { ExportsFigures } from './exports-page';
import { readFigureRows } from './figure-rows';

const FILES = import.meta.glob<string>('../../../packages/site/fixtures/report/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const rowsOf = (name: string) => {
  const text = Object.entries(FILES).find(([path]) => path.endsWith(`/${name}`))?.[1];
  if (text === undefined) throw new Error(`The fixture ${name} is missing.`);
  return readFigureRows(name, text);
};

export const EXPORTS_FIGURES: ExportsFigures = {
  budget: rowsOf('budget-share.csv'),
  ledger: rowsOf('revenue-ledger.csv'),
  sellers: rowsOf('seller-timeline.csv'),
};
