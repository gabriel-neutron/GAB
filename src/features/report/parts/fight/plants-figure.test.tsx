import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportContext } from '../../use-report';
import { arcs, chainCount } from './chain-data';
import { ChainStory } from './chain-story';
import { PlantsFigure } from './plants-figure';
import { plants } from './plants-data';

const report = { openNode: () => undefined };
const html = (node: ReactNode) =>
  renderToStaticMarkup(<ReportContext.Provider value={report}>{node}</ReportContext.Provider>);
const unescape = (text: string) =>
  text
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
// The cells of each body row of the table, the row head first.
const tableRows = (markup: string) =>
  [...markup.matchAll(/<tr[^>]*><th scope="row"[^>]*>(.*?)<\/tr>/g)].map((row) =>
    [...row[0].matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/g)].map((cell) => unescape(cell[1] ?? '')),
  );

describe('PlantsFigure', () => {
  const markup = html(<PlantsFigure />);
  const marks = [...markup.matchAll(/data-plant="([^"]*)"/g)].map((m) => unescape(m[1] ?? ''));
  const rows = tableRows(markup);

  it('lists every plant of the data file in the table', () => {
    expect(rows.map((row) => row[0])).toEqual(plants.map((plant) => plant['entity']));
  });

  it('draws one point for each row with a position, and none for the others', () => {
    const placed = plants
      .filter((plant) => plant['lat'] !== '' && plant['lon'] !== '')
      .map((plant) => plant['entity']);
    expect(marks).toEqual(placed);
    expect(marks.length).toBeGreaterThan(0);
    const offMap = rows.filter((row) => !marks.includes(row[0] ?? ''));
    for (const row of offMap) expect(row[3]).toBe('not on the map');
  });
});

describe('ChainStory route table', () => {
  it('gives one row for each arc of the map, with its count of chains', () => {
    const rows = tableRows(html(<ChainStory sources="" partSlug="fight" />));
    const expected = arcs.map((arc) => [
      arc.from.name,
      arc.to.name,
      arc.state,
      chainCount(arc.weight),
    ]);
    expect(rows).toHaveLength(expected.length);
    for (const row of expected) expect(rows).toContainEqual(row);
  });
});
