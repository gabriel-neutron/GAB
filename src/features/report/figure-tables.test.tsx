import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { en } from './content';
import { fr } from './content-fr';
import figures from './data/publication-figures.json';
import { partComponents } from './parts';
import { criticalLayers } from './parts/method-chronology/critical-layers';
import { PartDefault } from './parts/part-default';
import { visitLayer } from './parts/ports-fleet/visit-layer';
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

// The figures of the page, in their order. The map of the ports loads only near the view, so the
// server markup has no map; its table has a test of its own below.
const pageFigures = (copy: ReportContent) =>
  render(
    copy,
    copy.parts.map((part) => {
      const Part = partComponents[part.slug] ?? PartDefault;
      return <Part key={part.slug} part={part} />;
    }),
  )
    .split('<figure')
    .slice(1)
    .map((one) => one.split('</figure>')[0] ?? '');

describe.each([
  ['en', en],
  ['fr', fr],
])('the figures of the %s page', (_, copy) => {
  const all = pageFigures(copy);
  const layersTitle = copy.parts
    .flatMap((part) => part.blocks)
    .find((block) => block.figure?.number === 2)?.figure?.title;
  // Two figures are text, not a chart: the summary chart prints each value under its bar, and the
  // layer diagram is cards of words with the count of each layer.
  const summary = all.filter((one) => one.includes(copy.openingUi.summary.chart.label));
  const layers = all.filter((one) => layersTitle !== undefined && one.includes(layersTitle));
  const charts = all.filter((one) => !summary.includes(one) && !layers.includes(one));

  it('finds every figure of the page', () => {
    expect(summary).toHaveLength(1);
    expect(layers).toHaveLength(1);
    expect(charts.length).toBeGreaterThan(10);
  });

  it('gives each chart a data table', () => {
    for (const one of charts) expect(one).toContain('<table');
  });

  it('gives the summary chart and the layer diagram their values as text', () => {
    for (const [year, value] of figures.f9.exports.Rouble)
      expect(summary[0]).toContain(`${String(year)}: ${String(Math.round(value ?? 0))}%`);
    for (const count of criticalLayers.values()) expect(layers[0]).toContain(`>${String(count)}<`);
  });
});

describe('the table of the port visits', () => {
  it('is a disclosure that a reader can open at all times', () => {
    for (const copy of [en, fr]) {
      const html = render(copy, <visitLayer.Table />);
      expect(html).toContain(`<summary`);
      expect(html).toContain(copy.portsFleetUi.map.visits.table);
      expect(html).toContain('<table');
      expect(html).not.toContain('sr-only');
    }
  });
});
