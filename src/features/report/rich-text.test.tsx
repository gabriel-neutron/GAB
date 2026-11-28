import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportContext } from './use-report';
import { RichText } from './rich-text';

describe('RichText', () => {
  it('keeps the punctuation next to a node reference in one box that does not break', () => {
    const html = renderToStaticMarkup(
      <ReportContext.Provider value={{ openNode: () => undefined }}>
        <RichText text="the Agency ([[N-P026|Rosneft]]), which" />
      </ReportContext.Provider>,
    );
    expect(html).toMatch(/^<span>the Agency <\/span><span class="whitespace-nowrap[^"]*">\(/);
    expect(html).toMatch(/Rosneft<\/button>\),<\/span><span> which<\/span>$/);
  });

  it('keeps a bare note marker after a node reference in the box of the reference', () => {
    const html = renderToStaticMarkup(
      <ReportContext.Provider value={{ openNode: () => undefined }}>
        <RichText text="through [[N-M007|India VTB]].[^68] Then" compact />
      </ReportContext.Provider>,
    );
    expect(html).toMatch(/VTB<\/button>\.<sup[^>]*>68<\/sup><\/span><span> Then<\/span>$/);
  });

  it('draws a reference of the text after a space, before the punctuation that follows it', () => {
    const html = renderToStaticMarkup(
      <RichText text="fell by 84%[^2]; China" partSlug="summary" />,
    );
    expect(html).toMatch(
      /^<span>fell by 84%<\/span> <a href="[^"]*bibliography#ref-kse-rot-feb26"[^>]*>\(Dodonov et al\., 2026, p\. 3\)<\/a><span>; China<\/span>$/,
    );
  });
});
