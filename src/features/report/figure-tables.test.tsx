import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { en } from './content';
import { fr } from './content-fr';
import figures from './data/publication-figures.json';
import { partComponents } from './parts';
import { criticalLayers } from './parts/method-chronology/critical-layers';
import { PartDefault } from './parts/part-default';
import { ContentContext, type ReportContent } from './use-content';
import { ReportContext } from './use-report';

// The annex links with the router; a plain anchor is enough here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { readonly children: ReactNode }) => <a>{children}</a>,
}));

const render = (copy: ReportContent, node: ReactNode) =>
  renderToStaticMarkup(
    <ContentContext.Provider value={copy}>
      <ReportContext.Provider value={{ openNode: () => undefined }}>{node}</ReportContext.Provider>
    </ContentContext.Provider>,
  );

// The markup of the page. The map of the ports loads only near the view, so it has no map here.
const pageOf = (copy: ReportContent) =>
  render(
    copy,
    copy.parts.map((part) => {
      const Part = partComponents[part.slug] ?? PartDefault;
      return <Part key={part.slug} part={part} />;
    }),
  );

// The figures of the page, in their order.
const figuresOf = (html: string) =>
  html
    .split('<figure')
    .slice(1)
    .map((one) => one.split('</figure>')[0] ?? '');

// The layer names of the data, in the order of the cards of figure 2.
const LAYERS = ['Pay', 'Finance', 'Fight'];

describe.each([
  ['en', en],
  ['fr', fr],
])('the figures of the %s page', (_, copy) => {
  const html = pageOf(copy);
  const all = figuresOf(html);
  const numbered = copy.parts.flatMap((part) =>
    part.blocks.flatMap((block) => (block.figure === undefined ? [] : [block.figure])),
  );
  const layersTitle = numbered.find((one) => one.number === 2)?.title;
  // Two figures are text, not a chart: the summary chart prints each value under its bar, and the
  // layer diagram is cards of words with the count of each layer.
  const summary = all.filter((one) => one.includes(copy.openingUi.summary.chart.label));
  const layers = all.filter((one) => layersTitle !== undefined && one.includes(layersTitle));
  const charts = all.filter((one) => !summary.includes(one) && !layers.includes(one));

  it('finds every numbered figure of the text on the page', () => {
    expect(summary).toHaveLength(1);
    expect(layers).toHaveLength(1);
    for (const one of numbered.filter((figure) => figure.number !== 2))
      expect(charts.filter((chart) => chart.includes(one.title))).toHaveLength(1);
  });

  it('gives each chart a data table with rows', () => {
    for (const one of charts) expect(one).toMatch(/<table[\s\S]*<tbody[^>]*><tr/);
  });

  it('gives the summary chart its values as text', () => {
    for (const [year, value] of figures.f9.exports.Rouble)
      expect(summary[0]).toContain(`${String(year)}: ${String(Math.round(value ?? 0))}%`);
  });

  it('gives each card of the layer diagram the count of its own layer', () => {
    const cards = (layers[0] ?? '').split('lg:grid-rows-subgrid').slice(1);
    expect(cards).toHaveLength(LAYERS.length);
    LAYERS.forEach((layer, index) => {
      const count = criticalLayers.get(layer);
      expect(count).toBeGreaterThan(0);
      expect(cards[index]).toContain(`>${String(count)}<`);
    });
  });

  it('gives the port visits a table that a reader can open at all times', () => {
    const at = html.indexOf(`>${copy.portsFleetUi.map.visits.table}</summary>`);
    expect(at).toBeGreaterThan(0);
    const disclosure = html.slice(html.lastIndexOf('<details', at), html.indexOf('</details>', at));
    expect(disclosure).toMatch(/<table[\s\S]*<tbody[^>]*><tr/);
    expect(disclosure).not.toContain('sr-only');
  });
});
