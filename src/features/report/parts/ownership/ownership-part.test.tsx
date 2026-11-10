import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../content';
import { ContentContext, type ReportContent } from '../../use-content';
import { ReportContext } from '../../use-report';
import { OwnershipPart } from './ownership-part';

describe.each([['en', en]] as const)(
  'the ownership part of the %s page',
  (_lang, copy: ReportContent) => {
    it('puts its list items in one list', () => {
      const part = copy.parts.find((one) => one.slug === 'ownership');
      const count = part?.blocks.filter((block) => block.kind === 'li').length ?? 0;
      expect(count).toBeGreaterThan(0);
      const html = renderToStaticMarkup(
        <ContentContext.Provider value={copy}>
          <ReportContext.Provider value={{ openNode: () => undefined }}>
            {part === undefined ? null : <OwnershipPart part={part} />}
          </ReportContext.Provider>
        </ContentContext.Provider>,
      );
      const list = html.split('<ul>')[1]?.split('</ul>')[0] ?? '';
      expect(list.split('<li').length - 1).toBe(count);
    });
  },
);
