import { reportAddress } from './report-context';
import { useId, useRef, useState } from 'react';

export const references = [
  {
    id: 1,
    author:
      'Dodonov, B., Hilgenstock, B., Kravtsev, A., Pavytska, Y., Petrenko, O., & Shapoval, N.',
    date: '2026, February',
    title: 'Russian oil tracker',
    publisher: 'KSE Institute',
    url: 'https://sanctions.kse.ua/wp-content/uploads/2026/03/ROT_FEB26.pdf',
    note: 'Fleet classification and January 2026 seaborne volumes. Report pages 3 and 13–14.',
  },
  {
    id: 2,
    author: 'GAB',
    date: '2026',
    title: 'Loading basins, January 2026: Figure 7A extract',
    publisher:
      'Working dataset, transcribed from the supplied report; KSE / CREA, drawing on Kpler',
    url: import.meta.env.BASE_URL + 'report-data/basins.json',
    note: 'Thousand barrels per day. No fleet-to-buyer links are inferred.',
  },
  {
    id: 3,
    author: 'World Bank',
    date: '2026, October 2',
    title: 'Commodity price data (The Pink Sheet): Monthly prices',
    publisher: 'World Bank',
    url: 'https://www.worldbank.org/en/research/commodity-markets',
    note: 'Brent series. Exact cells and archived document identifiers are retained in the downloadable price table.',
  },
  {
    id: 4,
    author: 'GAB',
    date: '2026',
    title: 'Brent, Urals and the EU price cap: Source table for figure 4',
    publisher:
      'Working data compilation from the Russian Federal Tax Service, Ministry of Finance, Ministry of Economic Development, World Bank and EU acts',
    url: import.meta.env.BASE_URL + 'report-data/oil-prices.csv',
    note: 'Urals is the Russian tax-base price, not a contract price. Missing months stay missing.',
  },
  {
    id: 5,
    author: 'Council of the European Union',
    date: '2022, December 3',
    title: 'Council Regulation (EU) 2022/2367 amending Regulation (EU) No 833/2014',
    publisher: 'Official Journal of the European Union',
    url: 'https://eur-lex.europa.eu/eli/reg/2022/2367/oj',
  },
  {
    id: 6,
    author: 'Council of the European Union',
    date: '2025, July 18',
    title: 'Council Regulation (EU) 2025/1494 amending Regulation (EU) No 833/2014',
    publisher: 'Official Journal of the European Union',
    url: 'https://eur-lex.europa.eu/eli/reg/2025/1494/oj',
  },
  {
    id: 7,
    author: 'European Commission',
    date: '2026, January 14',
    title: 'Commission Implementing Regulation (EU) 2026/124',
    publisher: 'Official Journal of the European Union',
    url: 'https://eur-lex.europa.eu/eli/reg_impl/2026/124/oj',
    note: 'The annex records the three cap amounts and their applicable dates.',
  },
  {
    id: 8,
    author: 'Office of Foreign Assets Control',
    date: '2025, October 22',
    title:
      'Russia-related designations; Issuance of new and amended Russia-related general licenses',
    publisher: 'U.S. Department of the Treasury',
    url: 'https://ofac.treasury.gov/recent-actions/20251022',
  },
  {
    id: 9,
    author: 'Kpler',
    date: '2025, December 2',
    title:
      'Rosneft and Lukoil sanctions are live: How India, China and Turkey adapt rather than exit',
    publisher: 'Kpler',
    url: 'https://cn.kpler.com/blog/rosneft-and-lukoil-sanctions-are-live-how-india-china-and-turkey-adapt-rather-than-exit',
  },
  {
    id: 10,
    author: 'GAB',
    date: '2026',
    title: 'Selected infrastructure nodes and geographic positions',
    publisher: 'Working extract of f2-v2.csv',
    url: import.meta.env.BASE_URL + 'report-data/nodes.json',
    note: 'Positions retain their original basis and source. Some are settlement or town points, not surveyed terminal boundaries.',
  },
  {
    id: 11,
    author: 'GAB',
    date: '2026',
    title: 'Transneft: Selected ownership and operation relations',
    publisher: 'Working extract of f2-v2-edges.csv',
    url: import.meta.env.BASE_URL + 'report-data/edges.json',
    note: 'Only rows marked promoted fact with documentary identifiers are drawn. This is an extract, not the complete graph.',
  },
  {
    id: 12,
    author: 'Natural Earth',
    date: 'n.d.',
    title: 'Admin 0 – Countries, 1:50m',
    publisher: 'Natural Earth',
    url: 'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/',
    note: 'Public-domain basemap, simplified and clipped in the existing project.',
  },
];
export function APA({ source }: { source: (typeof references)[number] }) {
  return (
    <>
      <span>
        {source.author} ({source.date}).{' '}
      </span>
      <a href={source.url}>
        <i>{source.title}</i>
      </a>
      <span>. {source.publisher}.</span>
    </>
  );
}
export function Citation({ id }: { id: number }) {
  const key = useId();
  const pop = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const source = references.find((r) => r.id === id);
  if (!source) throw new Error(`Unknown citation ${id}`);
  const close = () => {
    pop.current?.hidePopover();
    anchor.current?.focus();
  };
  return (
    <sup className="citation">
      <a
        ref={anchor}
        href={reportAddress(`bibliography#ref-${id}`)}
        aria-label={`Source ${id}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !pop.current?.showPopover) return;
          e.preventDefault();
          if (open) {
            close();
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          const width = Math.min(384, innerWidth - 32);
          setPos({
            left: Math.max(16, Math.min(r.left, innerWidth - width - 16)),
            top: Math.max(16, Math.min(r.bottom + 12, innerHeight - 360)),
            width,
          });
          pop.current.showPopover();
        }}
      >
        {id}
      </a>
      <span
        ref={pop}
        id={key}
        popover="auto"
        role="dialog"
        aria-label={`Source ${id}`}
        className="citation-popover"
        style={pos}
        onToggle={(e) => setOpen(e.newState === 'open')}
      >
        <span className="citation-top">
          <span className="meta">Source {id}</span>
          <button onClick={close} aria-label="Close source">
            ×
          </button>
        </span>
        <span className="citation-body">
          <APA source={source} />
        </span>
        {source.note && <span className="citation-note">{source.note}</span>}
        <a className="bibliography-link" href={reportAddress(`bibliography#ref-${id}`)}>
          View in bibliography ↗
        </a>
      </span>
    </sup>
  );
}
export function Bibliography() {
  return (
    <section className="bibliography-page">
      <p className="meta">GAB / Research report / References</p>
      <h1>Bibliography</h1>
      <p>
        Sources for this report extract. Citations use APA-style author, date, title and publisher
        entries. Working datasets are identified separately from their primary sources.
      </p>
      <a className="source-link" href={reportAddress()}>
        ← Return to the report
      </a>
      <ol>
        {references.map((r) => (
          <li key={r.id} id={`ref-${r.id}`}>
            <span className="reference-number">{r.id}</span>
            <div>
              <p>
                <APA source={r} />
              </p>
              {r.note && <p className="citation-note">{r.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
