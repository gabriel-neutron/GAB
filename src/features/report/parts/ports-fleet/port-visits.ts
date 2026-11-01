import file from '../../data/port-visits.json';

// The GFW port ids of the query, by terminal of the map.
const TERMINAL_OF: Readonly<Record<string, string>> = {
  'rus-primorsk': 'N-P001',
  'rus-ustluga': 'N-P002',
  'rus-novorossiysk': 'N-P005',
  'rus-tuapse': 'N-P011',
  'rus-kozmino': 'N-P007',
};
const DAY = 86_400_000;
const from = Date.parse(file.parameters.from);
const days = (Date.parse(file.parameters.to) - from) / DAY;

/** The AIS port visits of the tankers named in the report, from one dated GFW query: each visit
 * at its terminal and its day in the window, and the counts of the table and the credit. One job:
 * the data of the visit layer of the ports map. */
export const portVisits = {
  file,
  /** The length of the window, in days. */
  days,
  visits: file.visits.map((visit) => ({
    id: visit.event,
    terminal: TERMINAL_OF[visit.port] ?? '',
    day: (Date.parse(visit.start) - from) / DAY,
  })),
  /** For each port of the query: the visits and the distinct tankers. */
  ports: file.parameters.anchorageIds.map((port) => {
    const here = file.visits.filter((visit) => visit.port === port);
    return {
      port,
      terminal: TERMINAL_OF[port] ?? '',
      visits: here.length,
      tankers: new Set(here.map((visit) => visit.imo)).size,
    };
  }),
  /** The tankers of the list with at least one visit in the window. */
  tankersSeen: new Set(file.visits.map((visit) => visit.imo)).size,
  /** The layer waits for the legal review of the GFW licence: a release build never shows it. */
  on: (env: Readonly<Record<string, unknown>>): boolean => env['VITE_SITE_RELEASE'] !== '1',
};
