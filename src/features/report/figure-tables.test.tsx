import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
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

// The markup of the page. The map of the ports loads only near the view, so it has no map here.
// The code of a part loads late: a first render loads it, as the render at the release does.
const pageOf = async (copy: ReportContent) => {
  const page = (
    <ContentContext.Provider value={copy}>
      <ReportContext.Provider value={{ openNode: () => undefined }}>
        {copy.parts.map((part) => {
          const Part = partComponents[part.slug] ?? PartDefault;
          return <Part key={part.slug} part={part} />;
        })}
      </ReportContext.Provider>
    </ContentContext.Provider>
  );
  await prerender(page);
  return renderToStaticMarkup(page);
};
const pages = { en: await pageOf(en), fr: await pageOf(fr) };

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
] as const)('the figures of the %s page', (lang, copy) => {
  const html = pages[lang];
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

describe.each([
  ['en', en],
  ['fr', fr],
] as const)('the citations of the %s page', (lang, copy) => {
  const html = pages[lang];

  it('draws each note marker with the shared marker only', () => {
    // The bare marker of a text with no part, or a note printed beside the text, is another system.
    expect(html).not.toContain('<sup');
    expect(html).not.toMatch(/\[\^[^\]]+\]/);
    // A closed note is not in the markup; a note printed in full beside its text is.
    for (const note of copy.parts.flatMap((part) => part.notes))
      expect(html).not.toContain(note.text.replaceAll('*', ''));
    // Each control that opens a dialog is the shared marker, except the card of a node reference.
    const markers = (html.match(/<button[^>]*>/g) ?? []).filter(
      (one) =>
        one.includes('aria-haspopup="dialog"') && !one.includes('data-slot="popover-trigger"'),
    );
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) expect(marker).toContain('note-ref');
    // Each part with a note mark in its text draws at least one marker.
    // A part ends where the next part starts.
    const starts = copy.parts.map((part) => html.indexOf(`<section id="${part.slug}"`));
    copy.parts.forEach((part, index) => {
      if (!part.blocks.some((block) => block.text.includes('[^'))) return;
      expect(starts[index]).toBeGreaterThanOrEqual(0);
      expect(html.slice(starts[index], starts[index + 1])).toContain('note-ref');
    });
  });

  it('gives each summary value with a note the marker of that note', () => {
    for (const { note } of copy.openingUi.summary.values.filter((one) => one.note !== ''))
      expect(html).toMatch(
        new RegExp(
          `<p class="[^"]*text-report-(?:display|number)[^"]*">(?:(?!</p>).)*aria-label="${copy.ui.note.label} ${note}"`,
          's',
        ),
      );
  });

  it('gives each image of the page a credit and its marker', () => {
    const { items } = copy.ui.bibliography.images;
    const files = new Set(JSON.stringify(copy).match(/report-media\/[\w.-]+/g) ?? []);
    expect(files.size).toBeGreaterThan(0);
    for (const file of files) expect(items.some((item) => file.includes(item.file))).toBe(true);
    // Each credit names a file of the credits record.
    const credits = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../public/report-media/credits.json'), 'utf8'),
    ) as readonly { readonly file: string }[];
    for (const item of items)
      expect(credits.some((one) => one.file.includes(item.file))).toBe(true);
    // The art that the parts draw shows the marker of its credit.
    const art = [
      copy.openingUi.summary.art,
      copy.openingUi.introduction.art,
      copy.payUi.image,
      copy.portsFleetUi.art,
      copy.financeUi.image,
      copy.fightUi.image,
      copy.ownershipUi.image,
    ];
    for (const src of art) {
      const mark = items.findIndex((item) => src.includes(item.file)) + 1;
      expect(mark).toBeGreaterThan(0);
      expect(html).toContain(`aria-label="${copy.ui.note.image} ${String(mark)}"`);
    }
  });
});
