import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { describe, expect, it, vi } from 'vitest';
import { citeText, splitNote } from './bibliography';
import { en } from './content';
import figures from './data/publication-figures.json';
import { partComponents } from './parts';
import { criticalLayers } from './parts/method-chronology/critical-layers';
import { PartDefault } from './parts/part-default';
import { ContentContext, type ReportContent } from './use-content';
import { ReportContext } from './use-report';

// The text as React writes it in the markup, and as a pattern.
const markup = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const noteText = (id: string): string =>
  en.parts.flatMap((part) => part.notes).find((note) => note.id === id)?.text ?? '';

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
const pages = { en: await pageOf(en) };

// The figures of the page, in their order.
const figuresOf = (html: string) =>
  html
    .split('<figure')
    .slice(1)
    .map((one) => one.split('</figure>')[0] ?? '');

// The layer names of the data, in the order of the cards of figure 2.
const LAYERS = ['Pay', 'Finance', 'Fight'];

describe.each([['en', en]] as const)('the figures of the %s page', (lang, copy) => {
  const html = pages[lang];
  const all = figuresOf(html);
  const numbered = copy.parts.flatMap((part) =>
    part.blocks.flatMap((block) => (block.figure === undefined ? [] : [block.figure])),
  );
  const layersTitle = numbered.find((one) => one.number === 2)?.title;
  // Two figures are text, not a chart: the summary chart prints each value under its bar, and the
  // layer diagram is cards of words, with no count of its own layer.
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

  it('gives no card of the layer diagram a count of its own layer', () => {
    // The release gives no layer, so the count of critical nodes stays a total (Annex A.3).
    const cards = (layers[0] ?? '').split('lg:grid-rows-subgrid').slice(1);
    expect(cards).toHaveLength(LAYERS.length);
    LAYERS.forEach((layer, index) => {
      expect(cards[index]).not.toContain(`>${String(criticalLayers.get(layer))}<`);
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

describe.each([['en', en]] as const)('the citations of the %s page', (lang, copy) => {
  const html = pages[lang];

  it('draws each reference with the shared reference or the shared marker only', () => {
    // The bare marker of a text with no part, or a note printed beside the text, is another system.
    expect(html).not.toContain('<sup');
    expect(html).not.toMatch(/\[\^[^\]]+\]/);
    expect(html).not.toMatch(/@[a-z0-9-]+-[a-z0-9]/);
    // A closed note is not in the markup: its short note shows only when it opens.
    for (const note of copy.parts.flatMap((part) => part.notes)) {
      const { note: short } = splitNote(note.text);
      if (short !== '') expect(html).not.toContain(markup(short));
    }
    // Each control that opens a dialog is the shared marker or the shared reference, except the
    // card of a node reference.
    const markers = (html.match(/<(?:button|a)[^>]*>/g) ?? []).filter(
      (one) =>
        one.includes('aria-haspopup="dialog"') && !one.includes('data-slot="popover-trigger"'),
    );
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) expect(marker).toMatch(/note-ref|note-cite/);
    // Each part with a note mark in its text draws at least one reference.
    // A part ends where the next part starts.
    const starts = copy.parts.map((part) => html.indexOf(`<section id="${part.slug}"`));
    copy.parts.forEach((part, index) => {
      if (!part.blocks.some((block) => block.text.includes('[^'))) return;
      expect(starts[index]).toBeGreaterThanOrEqual(0);
      expect(html.slice(starts[index], starts[index + 1])).toMatch(/note-ref|note-cite/);
    });
  });

  it('shows the short reference of each note of a text block in its parenthesis', () => {
    for (const part of copy.parts)
      for (const block of part.blocks.filter((one) => one.kind !== 'figure'))
        for (const match of block.text.matchAll(/\[\^([^\]]+)\]/g)) {
          const note = part.notes.find((one) => one.id === match[1]);
          const cite = citeText(note?.text ?? '');
          // A scroll figure shows a range of the sentences of its paragraph: a sentence that the
          // page does not show has no reference there.
          const before = block.text.slice(Math.max(0, match.index - 24), match.index);
          const shown = part.slug !== 'ports-fleet' || html.includes(markup(before));
          // A note with no reference in the text shows only its number.
          if (cite !== '' && shown) expect(html).toContain(`(${markup(cite)})`);
        }
  });

  it('gives each summary value with a note the marker of that note', () => {
    for (const { note } of copy.openingUi.summary.values.filter((one) => one.note !== ''))
      expect(html).toMatch(
        new RegExp(
          `<p class="[^"]*text-report-(?:display|number)[^"]*">(?:(?!</p>).)*aria-label="${copy.ui.note.label}: ${escaped(markup(citeText(noteText(note)))) || String.raw`\d+`}"`,
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
