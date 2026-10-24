import { useMemo, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { READING_LINK } from '@/shared/page/reading-link';
import { Input } from '@/shared/ui/input';
import { keyWords } from '@gab/proposal/key-words';
import { typeLabel } from '@/shared/type-label';

import {
  commonKeys,
  csvOf,
  filterRows,
  jsonOf,
  sortRows,
  type EntityRow,
  type Sort,
  type SortKey,
} from './entity-rows';

interface EntityTableProps {
  readonly rows: readonly EntityRow[];
  readonly hrefOf: (entityId: string) => string;
}

// A page shows this many rows, and a button adds as many. A few thousand rows stay fast, and
// select all still reaches every filtered row.
const PAGE = 100;

const HEAD = 'h-7 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';
const CELL = 'px-1.5 py-1.5 align-top break-words min-w-0';
const FOCUS = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
const TICK =
  'size-3.5 shrink-0 appearance-none rounded-none border border-input bg-muted checked:border-foreground checked:bg-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';
const ACTION = cn('h-6 border border-input bg-background px-2 text-xs disabled:text-label', FOCUS);

// External constraint: a browser saves a file only from an address, so the text becomes a Blob.
function save(text: string, name: string, type: string): void {
  const address = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = address;
  link.download = name;
  link.click();
  URL.revokeObjectURL(address);
}

/** A table of every entity: sort by a header, narrow by text and type, tick rows and save them
 * as CSV or JSON in the browser. */
export function EntityTable({ rows, hrefOf }: EntityTableProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>({ key: 'label', direction: 'ascending' });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(PAGE);

  const keys = useMemo(() => commonKeys(rows), [rows]);
  const types = useMemo(() => [...new Set(rows.map((row) => row.type))].sort(), [rows]);
  const filtered = useMemo(() => filterRows(rows, text, type), [rows, text, type]);
  const sorted = useMemo(() => sortRows(filtered, sort), [filtered, sort]);
  const chosen = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const allChosen = sorted.length > 0 && sorted.every((row) => selected.has(row.id));

  const columns: readonly {
    readonly key: SortKey;
    readonly header: string;
    readonly figure?: 'count';
  }[] = [
    { key: 'label', header: 'Entity' },
    { key: 'type', header: 'Type' },
    ...keys.map((key) => ({ key: `attr:${key}` as const, header: keyWords(key).label })),
    { key: 'sources', header: 'Documents', figure: 'count' },
  ];

  const sortBy = (key: SortKey): void => {
    setSort((now) => ({
      key,
      direction: now.key === key && now.direction === 'ascending' ? 'descending' : 'ascending',
    }));
    setShown(PAGE);
  };

  const toggle = (id: string): void => {
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelected((now) => {
      const next = new Set(now);
      for (const row of sorted) {
        if (allChosen) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs/5 text-label">
          Filter by name
          <Input
            type="search"
            autoComplete="off"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setShown(PAGE);
            }}
            className="w-56 rounded-none duration-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs/5 text-label">
          Type
          <select
            value={type ?? ''}
            onChange={(event) => {
              setType(event.target.value === '' ? null : event.target.value);
              setShown(PAGE);
            }}
            className={cn('h-8 rounded-none border border-input bg-background px-2 text-xs', FOCUS)}
          >
            <option value="">All types</option>
            {types.map((one) => (
              <option key={one} value={one}>
                {typeLabel(one)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={ACTION}
          disabled={chosen.length === 0}
          onClick={() => {
            save(
              csvOf(chosen, commonKeys(chosen, Infinity)),
              'selection.csv',
              'text/csv;charset=utf-8',
            );
          }}
        >
          Download selection (CSV)
        </button>
        <button
          type="button"
          className={ACTION}
          disabled={chosen.length === 0}
          onClick={() => {
            save(jsonOf(chosen), 'selection.json', 'application/json');
          }}
        >
          Download selection (JSON)
        </button>
      </div>

      <p role="status" className="text-label text-xs/5">
        {sorted.length} of {rows.length} {rows.length === 1 ? 'entity' : 'entities'}.{' '}
        {chosen.length} selected.
      </p>

      {sorted.length === 0 ? null : (
        <div
          // External constraint: a region that scrolls needs a tab stop for a keyboard.
          tabIndex={0}
          className={cn('max-w-full overflow-x-auto', FOCUS)}
        >
          <table
            aria-label="Entities"
            className="w-full border-collapse border border-border text-xs/5"
          >
            <thead className="border-b border-input bg-muted text-label">
              <tr>
                <th scope="col" className={cn(HEAD, 'w-6')}>
                  <input
                    type="checkbox"
                    aria-label="Select all filtered entities"
                    checked={allChosen}
                    onChange={toggleAll}
                    className={TICK}
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={sort.key === column.key ? sort.direction : 'none'}
                    className={cn(HEAD, column.figure === 'count' && 'text-right')}
                  >
                    <button
                      type="button"
                      className={cn('uppercase tracking-caps', FOCUS)}
                      onClick={() => {
                        sortBy(column.key);
                      }}
                    >
                      {column.header}
                      {sort.key === column.key
                        ? sort.direction === 'ascending'
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, shown).map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className={CELL}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.label}`}
                      checked={selected.has(row.id)}
                      onChange={() => {
                        toggle(row.id);
                      }}
                      className={TICK}
                    />
                  </td>
                  <th scope="row" className={cn(CELL, 'text-left font-normal')}>
                    <a href={hrefOf(row.id)} className={READING_LINK}>
                      {row.label}
                    </a>
                  </th>
                  <td className={CELL}>{typeLabel(row.type)}</td>
                  {keys.map((key) => (
                    <td key={key} className={CELL}>
                      {row.values[key] ?? ''}
                    </td>
                  ))}
                  <td className={cn(CELL, 'text-right font-mono tabular-nums')}>{row.sources}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > shown ? (
        <button
          type="button"
          className={cn(ACTION, 'self-start')}
          onClick={() => {
            setShown((now) => now + PAGE);
          }}
        >
          Show {Math.min(PAGE, sorted.length - shown)} more
        </button>
      ) : null}
    </div>
  );
}
