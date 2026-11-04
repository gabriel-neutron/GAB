import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fr } from '../../content-fr';
import { ContentContext } from '../../use-content';
import { SuppliersFigure } from './suppliers-figure';

describe('figure 11 on the French page', () => {
  it('writes its numbers in the French format', () => {
    const html = renderToStaticMarkup(
      <ContentContext.Provider value={fr}>
        <SuppliersFigure />
      </ContentContext.Provider>,
    );
    // A number such as 46.8 or 11.2 in the text of a cell or a label.
    expect(html).not.toMatch(/>[^<]*\d\.\d[^<]*</);
    expect(html).toMatch(/>[^<]*\d,\d\s%</);
  });
});
