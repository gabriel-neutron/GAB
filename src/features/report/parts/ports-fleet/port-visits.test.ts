import { describe, expect, it } from 'vitest';
import { portVisits } from './port-visits';
import { TERMINALS } from './terminals';

const { file } = portVisits;

describe('port visits of the tankers named in the report', () => {
  it('records the query date, the tool version and the parameters of the query', () => {
    expect(file.queryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(file.tool.name).toBe('gfw_port_visits');
    expect(file.tool.version).not.toBe('');
    expect(file.parameters).toMatchObject({
      anchorageIds: [
        'rus-primorsk',
        'rus-ustluga',
        'rus-novorossiysk',
        'rus-tuapse',
        'rus-kozmino',
      ],
      from: '2026-01-01',
      to: '2026-05-01',
      vesselType: null,
    });
    expect(file.imoList.count).toBe(file.imoList.imos.length);
  });

  it('keeps only visits of listed tankers that start in the window, once each', () => {
    const listed = new Set(file.imoList.imos);
    expect(file.visits.every((visit) => listed.has(visit.imo))).toBe(true);
    expect(
      file.visits.every(
        (visit) => visit.start >= file.parameters.from && visit.start < file.parameters.to,
      ),
    ).toBe(true);
    expect(new Set(file.visits.map((visit) => visit.event)).size).toBe(file.visits.length);
    const terminals = new Set(TERMINALS.map((terminal) => terminal.id));
    expect(portVisits.ports.every((port) => terminals.has(port.terminal))).toBe(true);
  });

  it('is off on a release build', () => {
    expect(portVisits.on({ VITE_SITE_RELEASE: '1' })).toBe(false);
    expect(portVisits.on({ VITE_SITE_RELEASE: '' })).toBe(true);
  });
});
