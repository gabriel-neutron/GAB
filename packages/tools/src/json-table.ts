import { z } from 'zod';

import type { CsvRecord } from './csv.ts';
import { ToolRefusal } from './tool.ts';

const string = z.string();
const BOM = '﻿';

/** The table of a JSON answer that holds a `data` list of objects (the answer of UN Comtrade).
 * One row for each element of the list. A column is a key of the elements, in the order of the
 * first element that holds it. A key that an element lacks, and a null, give an empty cell, never
 * a zero. A number stays the text of the source, so 1.10 stays 1.10. The span of a row is the
 * element in the page, in code points as a span counts them. The page must be valid JSON. */
export const readJsonTable = (text: string): { header: string[]; rows: CsvRecord[] } => {
  try {
    // A byte order mark is no part of the JSON text, but it stays in the span of the page.
    JSON.parse(text.startsWith(BOM) ? text.slice(1) : text);
  } catch {
    throw new ToolRefusal('the page is not valid JSON');
  }
  const points = Array.from(text);
  const refuse = (): never => {
    throw new ToolRefusal('the page is not an answer with a data list of objects');
  };
  const space = (from: number): number => {
    let at = from;
    while (/\s/u.test(points[at] ?? 'x')) at += 1;
    return at;
  };
  // The end of the string that opens at `from`.
  const stringEnd = (from: number): number => {
    let at = from + 1;
    while (points[at] !== '"') at += points[at] === '\\' ? 2 : 1;
    return at + 1;
  };
  // The end of the value that starts at `from`. The page is valid JSON, so brackets balance.
  const valueEnd = (from: number): number => {
    const first = points[from];
    if (first === '"') return stringEnd(from);
    if (first !== '{' && first !== '[') {
      let at = from;
      while (!/[\s,}\]]/u.test(points[at] ?? ',')) at += 1;
      return at;
    }
    let depth = 0;
    let at = from;
    while (at < points.length) {
      const point = points[at];
      if (point === '"') {
        at = stringEnd(at);
        continue;
      }
      if (point === '{' || point === '[') depth += 1;
      if (point === '}' || point === ']') depth -= 1;
      at += 1;
      if (depth === 0) return at;
    }
    return at;
  };
  const slice = (from: number, to: number): string => points.slice(from, to).join('');
  // The pairs of the object that starts at `from`: each key, and the text of its value.
  const pairsOf = (from: number, to: number): [string, string][] => {
    const pairs: [string, string][] = [];
    let at = space(from + 1);
    while (at < to - 1) {
      const keyEnd = stringEnd(at);
      const key = string.parse(JSON.parse(slice(at, keyEnd)));
      const start = space(keyEnd + 1);
      const end = valueEnd(start);
      pairs.push([key, slice(start, end)]);
      at = space(end);
      if (points[at] === ',') at = space(at + 1);
    }
    return pairs;
  };

  let at = space(0);
  if (points[at] !== '{') refuse();
  const spans: [number, number][] = [];
  const top = valueEnd(at);
  at = space(at + 1);
  while (at < top - 1) {
    const keyEnd = stringEnd(at);
    const key = string.parse(JSON.parse(slice(at, keyEnd)));
    const start = space(keyEnd + 1);
    const end = valueEnd(start);
    if (key === 'data' && points[start] === '[') {
      // The last `data` key wins, as it does in JSON.parse.
      spans.length = 0;
      let item = space(start + 1);
      while (item < end - 1) {
        if (points[item] !== '{') refuse();
        const itemEnd = valueEnd(item);
        spans.push([item, itemEnd]);
        item = space(itemEnd);
        if (points[item] === ',') item = space(item + 1);
      }
    }
    at = space(end);
    if (points[at] === ',') at = space(at + 1);
  }
  if (spans.length === 0) throw new ToolRefusal('the answer holds no data list with a row');

  const held = spans.map(([start, end]) => {
    const cells = new Map<string, string>();
    for (const [key, raw] of pairsOf(start, end)) {
      if (cells.has(key)) throw new ToolRefusal(`an element of the data list names ${key} twice`);
      cells.set(key, raw === 'null' ? '' : raw.startsWith('"') ? string.parse(JSON.parse(raw)) : raw);
    }
    return { start, end, cells };
  });
  const header = [...new Set(held.flatMap(({ cells }) => [...cells.keys()]))];
  if (header.some((name) => name.trim() === ''))
    throw new ToolRefusal('the data list holds a column with no name');
  return {
    header,
    rows: held.map(({ start, end, cells }) => ({
      fields: header.map((name) => cells.get(name) ?? ''),
      start,
      end,
    })),
  };
};
