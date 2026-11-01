import { motion, useMotionValue, useTransform } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { accent } from '../../primitives/accent';
import { useContent } from '../../use-content';
import { portVisits } from './port-visits';
import { TERMINALS } from './terminals';
import { ValuesTable } from './values-table';

// The time cursor runs once through the window of the query in this many seconds. No loop.
const SECONDS = 12;
const DAY = 86_400_000;
const start = Date.parse(portVisits.file.parameters.from);
const labelOf = new Map(TERMINALS.map((terminal) => [terminal.id, terminal.label]));

interface Point {
  readonly x: number;
  readonly y: number;
}

/** One pulse for each visit, at its terminal, when the time cursor reaches the day of the visit.
 * A terminal off the map gets no pulse. */
function Pulses({ at }: { readonly at: (terminal: string) => Point | null }) {
  return (
    <g aria-hidden="true">
      {portVisits.visits.map((visit) => {
        const point = at(visit.terminal);
        if (point === null) return null;
        return (
          <motion.circle
            key={visit.id}
            cx={point.x}
            cy={point.y}
            fill="none"
            strokeWidth={1}
            className={accent.stroke}
            initial={{ r: 3, opacity: 0 }}
            animate={{ r: [3, 18], opacity: [0.9, 0] }}
            transition={{
              duration: 1.2,
              delay: (visit.day / portVisits.days) * SECONDS,
              ease: 'easeOut',
            }}
          />
        );
      })}
    </g>
  );
}

/** The time cursor: the day it has reached, and a bar that fills once across the window. */
function Cursor() {
  const shortDay = new Intl.DateTimeFormat(useContent().ui.numberLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const share = useMotionValue(0);
  const day = useTransform(share, (value) =>
    shortDay.format(start + value * portVisits.days * DAY),
  );
  return (
    <div aria-hidden="true" className="grid w-40 gap-1 normal-case">
      <motion.span className="tabular-nums text-foreground">{day}</motion.span>
      <div className="h-px w-full bg-label/40">
        <motion.div
          className={cn('h-px w-full origin-left', accent.bg)}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: SECONDS, ease: 'linear' }}
          onUpdate={(latest) => {
            share.set(Number(latest['scaleX'] ?? 0));
          }}
        />
      </div>
    </div>
  );
}

/** The visits and the tankers for each port of the query: the text form of the pulses. A
 * disclosure that a reader can open at all times, also while the map moves. */
function Table() {
  const { portsFleetUi, ui } = useContent();
  const copy = portsFleetUi.map.visits;
  const number = new Intl.NumberFormat(ui.numberLocale);
  return (
    // The foot of the map lets the pointer through to the map; the disclosure takes it.
    <div className="pointer-events-auto">
      <ValuesTable
        summary={copy.table}
        head={[copy.port, copy.count, copy.tankers]}
        rows={portVisits.ports.map((port) => [
          labelOf.get(port.terminal) ?? port.port,
          number.format(port.visits),
          number.format(port.tankers),
        ])}
      />
    </div>
  );
}

/** The layer of the AIS port visits on the ports map: its pulses, its time cursor and its table.
 * Three parts of one layer, placed at three places of the map. */
export const visitLayer = { Pulses, Cursor, Table };
