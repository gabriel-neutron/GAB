import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from './content';
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
  it('lists the nodes', () => {
    expect(itemsOf(en)).toBeGreaterThan(0);
  });

  it('shows the layer names', () => {
    const html = htmlOf(en);
    for (const { label } of en.ui.index.layers) expect(html).toContain(label);
  });
});
