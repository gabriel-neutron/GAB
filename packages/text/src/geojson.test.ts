import { expect, test } from 'vitest';

import { geojsonArchiveOf } from './archive-fixture.ts';
import { extractText, mimeOfFileName } from './extract.ts';
import { layerCsv, layerNames, layerSetName } from './geojson.ts';
import { WorkbookFault } from './xlsx.ts';

const LINE = {
  type: 'LineString',
  coordinates: [
    [60, 55],
    [61.5, 56],
  ],
};

// Two segments with a route and one segment with no route, as the GEM files hold.
const ARCHIVE = geojsonArchiveOf({
  'GEM-pipelines.geojson': [
    {
      properties: { ProjectID: 'P1', Pipeline: 'Alpha, "main"', Countries: 'Russia' },
      geometry: LINE,
    },
    { properties: { ProjectID: 'P2', Pipeline: 'Beta', Countries: 'Norway' }, geometry: LINE },
    {
      properties: { ProjectID: 'P3', Pipeline: 'Gamma', Countries: 'Russia', Note: 'no route' },
      geometry: null,
    },
  ],
});

test('the layers of an archive leave out the system entries and the files that are no layer', async () => {
  expect(await layerNames(ARCHIVE)).toStrictEqual(['GEM-pipelines.geojson']);
});

test('a layer is a table with a row for each feature and its geometry in one column', async () => {
  const text = await layerCsv(ARCHIVE, 'GEM-pipelines.geojson');

  expect(text.split('\r\n')).toStrictEqual([
    'ProjectID,Pipeline,Countries,Note,geometry',
    `P1,"Alpha, ""main""",Russia,,"${JSON.stringify(LINE).replaceAll('"', '""')}"`,
    `P2,Beta,Norway,,"${JSON.stringify(LINE).replaceAll('"', '""')}"`,
    'P3,Gamma,Russia,no route,',
    '',
  ]);
});

test('a filter keeps a feature with no geometry, and gives the same text each time', async () => {
  const filter = { column: 'Countries', value: 'Russia' };
  const text = await layerCsv(ARCHIVE, 'GEM-pipelines.geojson', filter);

  expect(text.split('\r\n').map((line) => line.slice(0, 2))).toStrictEqual(['Pr', 'P1', 'P3', '']);
  expect(await layerCsv(ARCHIVE, 'GEM-pipelines.geojson', filter)).toBe(text);
});

test('the name of a text set holds the reader, the layer and the filter', () => {
  expect(layerSetName('a.geojson', { column: 'Countries', value: 'Russia' })).toBe(
    'geojson-1|layer=a.geojson|where=Countries=Russia',
  );
});

test('a layer or a column that the archive lacks gives a sentence', async () => {
  await expect(layerCsv(ARCHIVE, 'README.txt')).rejects.toThrow(WorkbookFault);
  await expect(
    layerCsv(ARCHIVE, 'GEM-pipelines.geojson', { column: 'x', value: 'y' }),
  ).rejects.toThrow(/no column "x"/u);
});

test('a Zip64 archive reads as a plain archive does', async () => {
  const same = geojsonArchiveOf({ 'a.geojson': [{ properties: { n: 1 }, geometry: null }] }, true);

  expect(await layerCsv(same, 'a.geojson')).toBe('n,geometry\r\n1,\r\n');
});

test('the door text of an archive is the head of each layer', async () => {
  expect(mimeOfFileName('routes.zip')).toBe('application/zip');

  const { pages } = await extractText(ARCHIVE, 'application/zip');

  expect(pages).toHaveLength(1);
  expect(pages[0]).toContain('P3,Gamma,Russia,no route,');
});
