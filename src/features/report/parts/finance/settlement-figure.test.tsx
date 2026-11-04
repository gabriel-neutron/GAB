import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fr } from '../../content-fr';
import { ContentContext } from '../../use-content';
import { ReportContext } from '../../use-report';
import { SettlementFigure } from './settlement-figure';

describe('figure 10 on the French page', () => {
  it('writes its shares in the French format', () => {
    const part = fr.parts.find((one) => one.slug === 'finance');
    const block = part?.blocks.find((one) => one.figure?.number === 10);
    if (part === undefined || block === undefined) throw new Error('No figure 10');
    const html = renderToStaticMarkup(
      <ContentContext.Provider value={fr}>
        <ReportContext.Provider value={{ openNode: () => undefined }}>
          <SettlementFigure block={block} partSlug={part.slug} />
        </ReportContext.Provider>
      </ContentContext.Provider>,
    );
    expect(html).not.toMatch(/>[^<]*\d\.\d[^<]*</);
    expect(html).toMatch(/>[^<]*\d,\d[^<]*</);
  });
});
