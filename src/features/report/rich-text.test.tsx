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
});
