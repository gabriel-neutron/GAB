import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from './content';
import { fr } from './content-fr';
import { NodeIndex } from './node-index';
import { ContentContext, type ReportContent } from './use-content';
import { ReportContext } from './use-report';

const htmlOf = (copy: ReportContent) =>
  renderToStaticMarkup(
    <ContentContext.Provider value={copy}>
      <ReportContext.Provider value={{ openNode: () => undefined }}>
        <NodeIndex />
      </ReportContext.Provider>
    </ContentContext.Provider>,
  );
const itemsOf = (copy: ReportContent) => htmlOf(copy).split('<li').length - 1;

describe('the node index', () => {
  it('lists the same nodes on the French page as on the English page', () => {
    const count = itemsOf(en);
    expect(count).toBeGreaterThan(0);
    expect(itemsOf(fr)).toBe(count);
  });

  it('shows the layer names of the page locale', () => {
    const html = htmlOf(fr);
    for (const { label } of fr.ui.index.layers) expect(html).toContain(label);
  });
});
