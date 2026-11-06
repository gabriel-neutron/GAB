import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../content';
import { ContentContext } from '../../use-content';
import { ReportContext } from '../../use-report';
import { figureData } from './figure-data';
import { PortTraffic } from './port-traffic';

// The cells of the first table of figure 6: the head, then one row for each port.
const firstTable = () => {
  const html = renderToStaticMarkup(
    <ContentContext.Provider value={en}>
      <ReportContext.Provider value={{ openNode: () => undefined }}>
        <PortTraffic />
      </ReportContext.Provider>
    </ContentContext.Provider>,
  );
  const table = html.split('<table')[1]?.split('</table>')[0] ?? '';
  return table
    .split('<tr')
    .slice(1)
    .map((row) => [...row.matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)].map((cell) => cell[1] ?? ''));
};

describe('the table of figure 6a', () => {
  it('puts each value of a port under its year', () => {
    const [head = [], ...rows] = firstTable();
    const number = new Intl.NumberFormat(en.ui.numberLocale);
    for (const series of figureData.traffic) {
      const row = rows.find((one) => one[0] === series.name) ?? [];
      expect(row).toHaveLength(head.length);
      for (const point of series.points)
        expect(row[head.indexOf(String(point.year))]).toBe(number.format(point.value));
    }
  });
});
