import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { EntityGlyph } from '@/shared/entity-glyph';
import { cn } from '@/shared/lib/utils';
import { ownershipUi } from '../../content';
import { accent } from '../../primitives/accent';
import { reportGraph } from '../../report-graph';
import { useReport } from '../../use-report';
import { BANDS, english, figure12, type Entity, type Link } from './ownership-graph';

const { entities, links } = figure12;
const nameOf = new Map(entities.map((one) => [one.id, one.name]));
const copy = ownershipUi.figure;
const keyOf = (link: Link): string => `${link.from}>${link.to}`;
// The chain that the figure shows at rest: from the State, through Transneft, to Novoport Holding
// (the holding of the port of Novorossiysk), and from
// Nord Axis to Vostok Oil and the 2Rivers network. The text names each of these links.
const CHAIN = new Set(['N-O001>N-P034', 'N-P034>N-O020', 'N-O049>N-O050', 'N-O049>N-O046']);
const chainNodes = new Set([...CHAIN].flatMap((key) => key.split('>')));
// On a phone, a band shows its first entities and a button opens the rest.
const PHONE_FIRST = 3;

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const LEGEND = [
  { key: 'possède, contrôle ou gère', dash: undefined, proposed: false, width: 1.5 },
  { key: 'lien personnel ou de direction', dash: '1 3', proposed: false, width: 1 },
  { key: 'fait proposé, en attente de validation', dash: '5 3', proposed: true, width: 1.5 },
] as const;
const typeOf = (id: string): string => reportGraph.glyph(reportGraph.node(id)?.type ?? '');

const dashOf = (link: Link): string | undefined =>
  link.personal ? '1 3' : link.proposed ? '5 3' : undefined;

// The bands group the entities by class, so an owner can sit below what it holds: an arrowhead
// at the end of each ownership line gives its direction, from the owner to what it holds.
const ARROW = { foreground: 'ownership-arrow', signal: 'ownership-arrow-signal' } as const;
const arrowOf = (link: { readonly personal: boolean; readonly proposed: boolean }) =>
  link.personal ? undefined : `url(#${link.proposed ? ARROW.signal : ARROW.foreground})`;

/** The two arrowheads, one per stroke colour. A marker cannot take the colour of its line. */
function Arrows() {
  return (
    <defs>
      {[
        [ARROW.foreground, 'fill-foreground'],
        [ARROW.signal, accent.fill],
      ].map(([id, fill]) => (
        <marker
          key={id}
          id={id}
          viewBox="0 0 6 6"
          refX="6"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" className={fill} />
        </marker>
      ))}
    </defs>
  );
}

/** One curve from the owner to what it holds, between the edges of the two boxes. */
function curve(from: Box, to: Box): string {
  const sx = from.x + from.w / 2;
  const tx = to.x + to.w / 2;
  if (Math.abs(from.y - to.y) < 4) {
    const lift = Math.min(40, Math.abs(tx - sx) / 3 + 12);
    return `M${sx},${from.y} C${sx},${from.y - lift} ${tx},${to.y - lift} ${tx},${to.y}`;
  }
  const down = to.y > from.y;
  const sy = down ? from.y + from.h : from.y;
  const ty = down ? to.y : to.y + to.h;
  const mid = (sy + ty) / 2;
  return `M${sx},${sy} C${sx},${mid} ${tx},${mid} ${tx},${ty}`;
}

/** Figure 12: the entities in four bands, from the State at the top to the intermediaries at the
 * bottom, an owner above what it holds, and the links drawn between them. Pointing at an entity
 * shows its links in words; a click opens its panel. */
export function OwnershipFigure() {
  const { openNode } = useReport();
  const [active, setActive] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<ReadonlyMap<string, Box>>(new Map());
  const [openBands, setOpenBands] = useState<ReadonlySet<number>>(new Set());
  const frame = useRef<HTMLDivElement>(null);
  const chips = useRef(new Map<string, HTMLButtonElement>());
  const near = useInView(frame, { once: true, margin: '400px 0px' });

  // An adapter: the browser lays out the boxes, and the curves follow them on each resize.
  useEffect(() => {
    const node = frame.current;
    if (!near || node === null) return undefined;
    const measure = () => {
      const origin = node.getBoundingClientRect();
      const next = new Map<string, Box>();
      chips.current.forEach((chip, id) => {
        const rect = chip.getBoundingClientRect();
        // A chip that a phone hides has no box, and draws no curve.
        if (rect.width === 0) return;
        next.set(id, {
          x: rect.left - origin.left,
          y: rect.top - origin.top,
          w: rect.width,
          h: rect.height,
        });
      });
      setBoxes(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [near]);

  const own = active === null ? [] : links.filter((l) => l.from === active || l.to === active);
  const lit = active === null ? chainNodes : new Set(own.flatMap((l) => [l.from, l.to]));

  const chip = (one: Entity, hideOnPhone = false) => (
    <button
      key={one.id}
      ref={(element) => {
        if (element === null) chips.current.delete(one.id);
        else chips.current.set(one.id, element);
      }}
      type="button"
      onPointerEnter={() => {
        setActive(one.id);
      }}
      onFocus={() => {
        setActive(one.id);
      }}
      onClick={(event) => {
        openNode(one.id, event.currentTarget);
      }}
      className={cn(
        'relative flex min-h-11 max-w-[18rem] min-w-0 flex-col items-start justify-center border bg-background px-2 py-1.5 text-left transition-opacity duration-100',
        FOCUS,
        hideOnPhone && 'max-md:hidden',
        one.id === active || (active === null && chainNodes.has(one.id))
          ? 'border-foreground'
          : 'border-transparent hover:border-foreground',
        // A chip out of the active set dims to the muted text colour, which keeps 4.5:1.
        active !== null && !lit.has(one.id) && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'flex items-baseline gap-1.5 break-words',
          one.band === 0 ? 'text-report-small ' : 'text-report-small',
        )}
      >
        <EntityGlyph type={typeOf(one.id)} size={one.band === 0 ? 10 : 8} className="shrink-0" />
        <span
          className={cn(
            one.band === 3 &&
              'underline decoration-muted-foreground/60 decoration-dotted decoration-1 underline-offset-4',
          )}
        >
          {one.name}
        </span>
      </span>
      <span className="font-mono text-report-label/4 text-muted-foreground">
        {one.holding ?? one.kind}
      </span>
    </button>
  );

  return (
    <div>
      <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2" aria-label={copy.legend}>
        {LEGEND.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2 text-report-small text-muted-foreground"
          >
            {/* The arrowheads are defined once, in the svg of the figure below. */}
            <svg aria-hidden="true" width="32" height="8" className="shrink-0">
              <line
                x1="0"
                y1="4"
                x2="32"
                y2="4"
                strokeWidth={item.width}
                strokeDasharray={item.dash}
                markerEnd={arrowOf({ personal: item.dash === '1 3', proposed: item.proposed })}
                className={item.proposed ? accent.stroke : 'stroke-foreground'}
              />
            </svg>
            {english(item.key)}
          </li>
        ))}
        <li className="flex items-center gap-2 text-report-small text-muted-foreground">
          <span
            aria-hidden="true"
            className="h-3 w-8 shrink-0 border border-dashed border-signal/70"
          />
          {english('propriétaire inconnu')}
        </li>
      </ul>
      <div
        ref={frame}
        className="relative [--grid:color-mix(in_oklab,var(--color-chart-grid)_55%,transparent)] bg-[linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] bg-size-[32px_32px]"
        onPointerLeave={() => {
          setActive(null);
        }}
        onBlur={(event) => {
          // Focus that leaves the figure clears the active entity, as the pointer does.
          if (!event.currentTarget.contains(event.relatedTarget)) setActive(null);
        }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <Arrows />
          {links.map((link) => {
            const from = boxes.get(link.from);
            const to = boxes.get(link.to);
            if (from === undefined || to === undefined) return null;
            const on =
              active === null ? CHAIN.has(keyOf(link)) : link.from === active || link.to === active;
            return (
              <path
                key={`${link.from}-${link.relation}-${link.to}`}
                d={curve(from, to)}
                fill="none"
                strokeWidth={(link.personal ? 1.25 : 1.5) + (on ? 0.75 : 0)}
                strokeDasharray={dashOf(link)}
                markerEnd={arrowOf(link)}
                className={cn(
                  'transition-opacity duration-100',
                  link.proposed ? accent.stroke : 'stroke-foreground',
                  // On a phone, only the chain at rest or the links of the active entity show.
                  on ? 'opacity-100' : 'opacity-[0.04] max-md:hidden',
                )}
              />
            );
          })}
        </svg>
        {BANDS.map((band, index) => {
          const members = entities.filter((one) => one.band === index);
          const placed = members.filter((one) => one.unnamedOwner === undefined);
          const rows = [...new Set(placed.map((one) => one.depth))].sort((a, b) => a - b);
          const owners = [...new Set(members.flatMap((one) => one.unnamedOwner ?? []))];
          const open = openBands.has(index);
          const order = [
            ...rows.flatMap((row) => placed.filter((one) => one.depth === row)),
            ...owners.flatMap((owner) => members.filter((one) => one.unnamedOwner === owner)),
          ];
          // The entities of the chain at rest show first on a phone; the order on the page stays.
          const first = [...order].sort(
            (a, b) => Number(chainNodes.has(b.id)) - Number(chainNodes.has(a.id)),
          );
          const shut = new Set(open ? [] : first.slice(PHONE_FIRST).map((one) => one.id));
          return (
            <section
              key={band}
              aria-label={english(band)}
              className="relative border-t border-border pt-3 pb-6 first:border-foreground md:pb-8"
            >
              <h4 className="mb-3 flex items-baseline gap-2 font-mono text-report-label uppercase text-label md:mb-4">
                <span className="tabular-nums text-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">{english(band)}</span>
                <span className="tabular-nums">{members.length}</span>
              </h4>
              <div className="space-y-3 md:space-y-10">
                {rows.map((row) => (
                  <div key={row} className="flex flex-wrap gap-1 md:gap-3">
                    {placed
                      .filter((one) => one.depth === row)
                      .map((one) => chip(one, shut.has(one.id)))}
                  </div>
                ))}
                {owners.map((owner) => {
                  const held = members.filter((one) => one.unnamedOwner === owner);
                  return (
                    <div
                      key={owner}
                      className={cn(
                        'border border-dashed border-signal/70 bg-background p-2 md:p-4',
                        held.every((one) => shut.has(one.id)) && 'max-md:hidden',
                      )}
                    >
                      <p className="mb-2 font-mono text-report-label text-label md:mb-3">
                        <span className={accent.text}>{english(owner)}</span> ·{' '}
                        {held.length > 1
                          ? english(
                              'possède ou exploite les navires de {n} armateurs ou gestionnaires :',
                            ).replace('{n}', String(held.length))
                          : english('propriétaire inconnu')}
                      </p>
                      <div className="flex flex-wrap gap-1 md:gap-2">
                        {held.map((one) => chip(one, shut.has(one.id)))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {order.length > PHONE_FIRST ? (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => {
                    const next = new Set(openBands);
                    if (open) next.delete(index);
                    else next.add(index);
                    setOpenBands(next);
                  }}
                  className={cn(
                    'mt-2 flex min-h-11 w-full items-center justify-between border-t border-divider font-mono text-report-label uppercase text-muted-foreground md:hidden',
                    FOCUS,
                  )}
                >
                  {open ? copy.fewer : copy.more.replace('{n}', String(order.length - PHONE_FIRST))}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-4 transition-transform', open && 'rotate-180')}
                  />
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
      {/* No live region: the table below gives the same links, so focus does not read them out. */}
      <div className="min-h-16 border-t border-foreground pt-3 text-report-small">
        {active === null ? (
          <p className="text-muted-foreground">{copy.hint}</p>
        ) : (
          <>
            <p>
              {nameOf.get(active)}{' '}
              <span className="font-mono text-report-label text-label tabular-nums">
                · {own.length} {copy.links}
              </span>
            </p>
            <ul className="mt-2 grid gap-x-8 gap-y-1 md:grid-cols-2">
              {own.map((link) => (
                <li key={`${link.from}-${link.relation}-${link.to}`} className="break-words">
                  {link.from === active ? '' : `${nameOf.get(link.from) ?? ''} `}
                  <span className="font-mono text-report-label text-label">
                    {link.relation}
                    {link.share === '' ? '' : ` ${link.share}`}
                  </span>
                  {link.to === active ? '' : ` ${nameOf.get(link.to) ?? ''}`}
                  <span
                    className={cn(
                      'ml-2 font-mono text-report-label',
                      link.proposed ? accent.text : 'text-label',
                    )}
                  >
                    {link.state}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <details className="group mt-6 border-y border-foreground">
        <summary
          className={cn(
            'flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-report-small [&::-webkit-details-marker]:hidden',
            FOCUS,
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
          <span className="min-w-0 flex-1">{copy.table}</span>
          <span className="font-mono text-report-label text-label tabular-nums uppercase">
            {copy.rows.replace('{n}', String(links.length))}
          </span>
        </summary>
        <div className="mb-4 overflow-x-auto" tabIndex={0} role="region" aria-label={copy.table}>
          <table className="w-full min-w-[40rem] border-collapse text-left text-report-small">
            <thead>
              <tr className="border-b border-border font-mono text-report-label uppercase text-label">
                {Object.values(copy.columns).map((column) => (
                  <th key={column} scope="col" className="py-2 pr-4 font-normal">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr
                  key={`${link.from}-${link.relation}-${link.to}`}
                  className="border-b border-divider align-top"
                >
                  <td className="py-2 pr-4">{nameOf.get(link.from)}</td>
                  <td className="py-2 pr-4 font-mono text-report-label">{link.relation}</td>
                  <td className="py-2 pr-4 font-mono text-report-label">{link.share}</td>
                  <td className="py-2 pr-4">{nameOf.get(link.to)}</td>
                  <td
                    className={cn(
                      'py-2 font-mono text-report-label',
                      link.proposed ? accent.text : 'text-label',
                    )}
                  >
                    {link.state}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
