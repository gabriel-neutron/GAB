import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../content';
import { ContentContext } from '../use-content';
import { ReportContext } from '../use-report';
import { ConclusionPart } from './conclusion';

describe('the conclusion', () => {
  it('shows a block after the four blocks of its layout', () => {
    const part = en.parts.find((one) => one.slug === 'conclusion');
    if (part === undefined) throw new Error('No conclusion');
    const extra = { ...part, blocks: [...part.blocks, { kind: 'p' as const, text: 'One more.' }] };
    const html = renderToStaticMarkup(
      <ContentContext.Provider value={{ ...en, parts: [extra] }}>
        <ReportContext.Provider value={{ openNode: () => undefined }}>
          <ConclusionPart part={extra} />
        </ReportContext.Provider>
      </ContentContext.Provider>,
    );
    expect(html).toContain('One more.');
  });
});
