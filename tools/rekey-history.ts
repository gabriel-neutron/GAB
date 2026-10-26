// Two more classes of pending or recorded acts that the re-key script handles (spec #958):
//
//   pnpm rekey:history                     dry run of both classes
//   pnpm rekey:history --class history     only the history merge
//   pnpm rekey:history --class bare        only the bare record entities (--since DATE sets the
//                                          first day, today by default; --with-rejected also reads
//                                          the rejected acts)
//   pnpm rekey:history --write [--limit N] sends the corrected acts of the first N ready items of
//                                          each class (one by default), then rejects the old acts
//
// History merge: an `update_attrs` act replaces the whole value of a key. A pending act that sets
// `mmsi_history` would delete the list of the record, so the new act holds the list of the record
// and the MMSI of the page. A `call_sign` that differs from the record is left out of the new act.
// Bare record entities: a vessel or a company of the record that has no IMO number, while an act
// of it carried one, gets a new `update_attrs` act with the number and a passage of the page.
// The script edits no proposal and writes nothing by SQL.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { z } from 'zod';

import type { Session } from '@gab/tools/tool';

import { connectionString } from './db-runtime.ts';
import { DRIFTED_KEYS, type Attrs, type Page, type Passage } from './rekey-attributes.ts';
import {
  ORIGINATOR,
  actRow,
  attrsOf,
  doorsOf,
  evidenceFor,
  readActsSql,
  type Act,
  type Doors,
  type Result,
} from './rekey-write.ts';

type Plan<T> =
  { readonly kind: 'send'; readonly value: T } | { readonly kind: 'hold'; readonly reason: string };

const hold = (reason: string): { readonly kind: 'hold'; readonly reason: string } => ({
  kind: 'hold',
  reason,
});

/** A pending or a refused act, as the database stores it. */
export type Carrier = Act & { readonly status: string };

/** An entity of the record. `src` of a value lists the documents that hold it up. */
export interface Recorded {
  readonly id: string;
  readonly type: string;
  readonly attrs: Readonly<
    Record<string, { readonly v: unknown; readonly src?: readonly string[] }>
  >;
}

/** What a corrected act holds. */
export interface Fix {
  readonly target: string;
  readonly attrs: Attrs;
  readonly more: readonly Passage[];
  /** The keys of the old act that the new act leaves out. */
  readonly left: readonly string[];
  /** The acts that the new act replaces. */
  readonly olds: readonly Carrier[];
  /** The act whose citations the new act takes. */
  readonly source: Act;
}

const elementsOf = (value: unknown): string[] => {
  if (Array.isArray(value))
    return value.flatMap((one: unknown) =>
      typeof one === 'string' || typeof one === 'number' ? [String(one).trim()] : [],
    );
  if (typeof value === 'number') return [String(value)];
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (text.startsWith('[')) {
    try {
      return elementsOf(JSON.parse(text) as unknown);
    } catch {
      // A text that only starts like a list is one value.
    }
  }
  return text === '' ? [] : [text];
};

const pagesOfAct = (act: Act): Page[] =>
  act.cites.flatMap((cite) =>
    typeof cite.pageText !== 'string'
      ? []
      : [{ document: cite.document, page: cite.page, text: cite.pageText }],
  );

// The main block of a page is the text before the block of the false data of the vessel.
const FALSE_DATA = /false\s+data/iu;
const split = (text: string): { main: string; fake: string } => {
  const at = text.search(FALSE_DATA);
  return at < 0 ? { main: text, fake: '' } : { main: text.slice(0, at), fake: text.slice(at) };
};

const labelled = (label: string, digits: number, text: string): RegExpExecArray[] =>
  Array.from(
    text.matchAll(
      new RegExp(String.raw`\b${label}\b[^\p{L}\d]{0,12}(\d{${String(digits)}})(?!\d)`, 'gu'),
    ),
  );

/** The first passage of a page of the main block that gives the number under the label. */
const labelledPassage = (
  label: string,
  digits: number,
  pages: readonly Page[],
  part: 'main' | 'fake',
): { passage: Passage; number: string }[] =>
  pages.flatMap((one) =>
    labelled(label, digits, split(one.text)[part]).map((found) => ({
      number: found[1] ?? '',
      passage: { document: one.document, page: one.page, excerpt: found[0] },
    })),
  );

// One passage for each document of the record that states the number, from the start of its line.
// A number in the block of false data of a page is no statement. A document that states it
// nowhere gives no passage.
const stating = (
  value: string,
  docs: readonly string[],
  pagesOf: ReadonlyMap<string, readonly Page[]>,
): Passage[] =>
  docs.flatMap((doc) => {
    const found = new RegExp(String.raw`(?<!\d)${value}(?!\d)`, 'u');
    for (const page of pagesOf.get(doc) ?? []) {
      const text = split(page.text).main;
      const at = found.exec(text);
      if (at === null) continue;
      const head = text.slice(Math.max(0, at.index - 40), at.index);
      const cut = head.lastIndexOf('\n');
      const line = cut >= 0 && head.length - cut - 1 >= 3 ? head.slice(cut + 1) : head;
      return [{ document: page.document, page: page.page, excerpt: `${line}${value}` }];
    }
    return [];
  });

// The block of false data can run on to the next page, which has no heading of its own.
const FALSE_RUNS_ON = 'the block of false data may run on to a page with no heading';
const runsOn = (pages: readonly Page[]): boolean =>
  pages.some(
    (one) =>
      !FALSE_DATA.test(one.text) &&
      pages.some(
        (other) =>
          other.document === one.document && other.page < one.page && FALSE_DATA.test(other.text),
      ),
  );

const sameText = (a: string, b: string): boolean =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

/** The corrected act for a pending `update_attrs` act on a vessel of the record that sets
 * `mmsi_history` or `call_sign`. `pagesOf` holds the stored pages of the documents that the record
 * cites for its list of MMSI. */
export const planHistory = (
  act: Carrier,
  record: Recorded | undefined,
  pagesOf: ReadonlyMap<string, readonly Page[]>,
): Plan<Fix> => {
  if (record === undefined) return hold('the target is not an entity of the record');
  if (record.type !== 'vessel') return hold('the target is no vessel');
  const attrs = attrsOf(act);
  if (Object.keys(attrs).some((key) => DRIFTED_KEYS.includes(key)))
    return hold('the act holds a drifted key: re-key it first');
  const pages = pagesOfAct(act);
  const more: Passage[] = [];
  // (e) The IMO of the page is the IMO of the record entity.
  const imo = labelledPassage('IMO', 7, pages, 'main')[0];
  const recordImo = elementsOf(record.attrs['imo']?.v)[0];
  if (recordImo === undefined) return hold('the vessel of the record has no IMO');
  if (imo === undefined) return hold('the page names no IMO under its label');
  if (imo.number !== recordImo)
    return hold('the IMO of the page differs from the IMO of the record');
  more.push(imo.passage);
  const kept: Record<string, { v: unknown }> = {};
  const left: string[] = [];
  for (const [key, held] of Object.entries(attrs)) {
    if (key === 'mmsi_history' || key === 'call_sign') continue;
    // A list would replace the list of the record in the same way as the history does.
    if (elementsOf(held.v).length > 1 || Array.isArray(held.v))
      return hold('the act holds another list: it would replace the list of the record');
    kept[key] = { v: held.v };
  }
  const call = attrs['call_sign'];
  if (call !== undefined) {
    const recorded = elementsOf(record.attrs['call_sign']?.v).at(-1);
    const given = elementsOf(call.v).at(-1);
    // (b) The call sign has one value, and the value of the record is of an older flag.
    if (recorded !== undefined && given !== undefined && !sameText(recorded, given))
      left.push('call_sign');
    else kept['call_sign'] = { v: call.v };
  }
  const history = attrs['mmsi_history'];
  if (history !== undefined) {
    const given = elementsOf(history.v);
    if (given.length === 0) return hold('the MMSI of the act is empty');
    if (given.some((one) => !/^\d{9}$/u.test(one)))
      return hold('the MMSI is no number of nine digits');
    const main = labelledPassage('MMSI', 9, pages, 'main');
    const fake = labelledPassage('MMSI', 9, pages, 'fake').map((one) => one.number);
    for (const one of given) {
      const at = main.find((found) => found.number === one);
      if (at !== undefined) more.push(at.passage);
      else if (fake.includes(one)) return hold('the MMSI stands in the block of false data');
      else return hold('the MMSI is not on the page under its label');
    }
    if (runsOn(pages)) return hold(FALSE_RUNS_ON);
    const listed = elementsOf(record.attrs['mmsi_history']?.v);
    const added = given.filter((one) => !listed.includes(one));
    // An act that sets a shorter list would delete an MMSI of the record: it gets the whole list.
    if (added.length > 0 || listed.some((one) => !given.includes(one))) {
      // (a) The record list and the MMSI of the page. Each MMSI of the record keeps a passage of
      // each document that holds it up, so its sources stay.
      const docs = record.attrs['mmsi_history']?.src ?? [];
      for (const one of listed) {
        const passages = stating(one, docs, pagesOf);
        if (passages.length < docs.length)
          return hold('an MMSI of the record is in no passage of one of its sources');
        more.push(...passages);
      }
      kept['mmsi_history'] = { v: [...listed, ...added] };
    }
  }
  if (Object.keys(kept).length === 0)
    return hold(left.length > 0 ? 'only the call sign differs' : 'the act changes nothing');
  const fix: Fix = { target: record.id, attrs: kept, more, left, olds: [act], source: act };
  return evidenceFor(act, kept, more) === null
    ? hold('the values need more than 10 passages')
    : { kind: 'send', value: fix };
};

/** The pending acts that change the same key of the same entity are held together: the one that
 * is promoted last would replace the other. */
export const planAllHistory = (
  acts: readonly Carrier[],
  records: ReadonlyMap<string, Recorded>,
  pagesOf: ReadonlyMap<string, readonly Page[]>,
): { act: Carrier; plan: Plan<Fix> }[] => {
  const sharing = new Map<string, number>();
  const keyOf = (act: Carrier, key: string): string => `${act.targetId ?? ''}\t${key}`;
  for (const act of acts)
    for (const key of ['mmsi_history', 'call_sign'])
      if (key in attrsOf(act))
        sharing.set(keyOf(act, key), (sharing.get(keyOf(act, key)) ?? 0) + 1);
  return acts.map((act) => ({
    act,
    plan: ['mmsi_history', 'call_sign'].some(
      (key) => (sharing.get(keyOf(act, key)) ?? 0) > 1 && key in attrsOf(act),
    )
      ? hold('two pending acts change the same key of the entity')
      : planHistory(act, act.targetId === null ? undefined : records.get(act.targetId), pagesOf),
  }));
};

// The IMO number ends with a check digit: the first six digits times 7 to 2, summed.
const imoCheck = (number: string): boolean => {
  const sum = Array.from(number.slice(0, 6)).reduce(
    (all, digit, at) => all + Number(digit) * (7 - at),
    0,
  );
  return sum % 10 === Number(number[6]);
};

const IMO_KEY = { vessel: 'imo', company: 'imo_company_number' } as const;

/** The number that a bare entity of the record lacks, from the acts that carried it. `holders`
 * lists the other entities of the record that hold the number. */
export const planBare = (
  entity: Recorded,
  carriers: readonly Carrier[],
  holders: ReadonlyMap<string, readonly string[]>,
): Plan<Fix> => {
  const key = entity.type === 'vessel' ? IMO_KEY.vessel : IMO_KEY.company;
  const given = new Set(carriers.flatMap((one) => elementsOf(attrsOf(one)[key]?.v)));
  const [number] = [...given];
  if (number === undefined) return hold('no act of the entity carries the number');
  if (given.size > 1) return hold('the acts give two numbers');
  if (!/^\d{7}$/u.test(number)) return hold('the number has no seven digits');
  if (entity.type === 'vessel' && !imoCheck(number))
    return hold('the check digit of the IMO is wrong');
  if ((holders.get(number) ?? []).some((id) => id !== entity.id))
    return hold('another entity of the record holds this number');
  const stated = new RegExp(
    String.raw`(?:\bIMO\b|ИМО)(?:\s+company)?(?:\s+(?:number|no\.?))?[^\p{L}\d]{0,12}(?<!\d)${number}(?!\d)`,
    'u',
  );
  const found = carriers.flatMap((one) =>
    pagesOfAct(one).flatMap((page) => {
      const excerpt = stated.exec(page.text)?.[0];
      return excerpt === undefined ? [] : [{ document: page.document, page: page.page, excerpt }];
    }),
  )[0];
  if (found === undefined) return hold('no page states the number under an IMO label');
  const first = carriers[0];
  if (first === undefined) return hold('no act of the entity carries the number');
  const cites = carriers.flatMap((one) => one.cites);
  const source: Act = { ...first, cites };
  const passages = [
    found,
    ...cites.map((cite) => ({
      document: cite.document,
      page: cite.page,
      excerpt: cite.excerpt ?? '',
    })),
  ];
  const attrs: Record<string, { v: unknown }> = { [key]: { v: number } };
  const left: string[] = [];
  for (const one of carriers)
    for (const [name, held] of Object.entries(attrsOf(one))) {
      if (name in attrs) continue;
      const words = elementsOf(held.v);
      const carried =
        words.length > 0 &&
        words.every((word) =>
          passages.some((p) =>
            new RegExp(
              String.raw`(?<![\p{L}\d])${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![\p{L}\d])`,
              'u',
            ).test(p.excerpt),
          ),
        );
      if (name in entity.attrs || !carried) left.push(name);
      else attrs[name] = { v: held.v };
    }
  // An old act that has a value left out stays: its rejection would lose that value.
  const fix: Fix = {
    target: entity.id,
    attrs,
    more: [found],
    left: [...new Set(left)],
    olds: left.length > 0 ? [] : carriers.filter((one) => one.status === 'pending'),
    source,
  };
  return evidenceFor(source, attrs, [found]) === null
    ? hold('the values need more than 10 passages')
    : { kind: 'send', value: fix };
};

type Item = Record<string, unknown>;

/** Sends one corrected act, and then rejects the old acts that it replaces. */
export const replace = async (fix: Fix, doors: Doors): Promise<Result> => {
  const key = fix.olds[0]?.id ?? fix.target;
  const stays = (reason: string, sent = 0): Result => ({
    key,
    status: 'refused',
    reason,
    sent,
    rejected: 0,
  });
  const evidence = evidenceFor(fix.source, fix.attrs, fix.more);
  if (evidence === null) return stays('the values need more than 10 passages');
  const item: Item = {
    ref: 'a1',
    act: {
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: fix.target,
      attrs: Object.fromEntries(
        Object.entries(fix.attrs).map(([name, one]) => [name, { v: one.v }]),
      ),
    },
    originator: ORIGINATOR,
    modality: fix.source.cites[0]?.modality,
    evidence,
  };
  const sent = await doors.send([item]);
  if (!sent.ok) return stays(sent.refusal);
  const made = sent.proposals[0];
  if (made === undefined) return stays('the door returned no new act', 1);
  if ((await doors.waiting([made.proposalId])) !== 1) return stays('the new act does not wait', 1);
  const weak = made.unstated.length > 0 || made.droppedBounds.length > 0;
  if (weak && !fix.olds.some((one) => one.dissent))
    return stays('the new act holds a value that no excerpt states', 1);
  let rejected = 0;
  try {
    for (const old of fix.olds.filter((one) => one.id !== made.proposalId)) {
      await doors.rejectUnit(old.id, `replaced by the act ${made.proposalId}`);
      rejected += 1;
    }
  } catch (cause) {
    return {
      key,
      status: 'refused',
      reason: `a rejection failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      sent: 1,
      rejected,
    };
  }
  return { key, status: 'done', sent: 1, rejected };
};

// ----------------------------------------------------------------------------- the database --

const recordRow = z.object({
  id: z.string(),
  type: z.string(),
  attrs: z.record(
    z.string(),
    z.looseObject({ v: z.unknown(), src: z.array(z.string()).optional() }),
  ),
});

const carrierOf = (row: z.output<typeof actRow>): Carrier => ({
  id: row.id,
  status: row.status,
  op: row.op,
  payload: row.payload,
  targetId: row.target_id,
  names: row.names,
  originator: row.originator,
  dissent: row.dissent,
  cites: row.cites,
});

const HISTORY_KEYS = ['mmsi_history', 'call_sign'];

export const readHistory = async (
  reader: Session,
): Promise<{ act: Carrier; plan: Plan<Fix> }[]> => {
  const acts = (
    await reader.query(
      readActsSql(
        "p.status = 'pending' AND p.op = 'update_attrs' AND p.payload->'attrs' ?| $1::text[]",
      ),
      [HISTORY_KEYS],
    )
  ).rows.map((one) => carrierOf(actRow.parse(one)));
  const targets = [
    ...new Set(acts.flatMap((one) => (one.targetId === null ? [] : [one.targetId]))),
  ];
  const records = new Map(
    (
      await reader.query(
        'SELECT id::text AS id, type, attrs FROM api.entity WHERE id = ANY($1::uuid[])',
        [targets],
      )
    ).rows
      .map((one) => recordRow.parse(one))
      .map((one) => [one.id, one as Recorded] as const),
  );
  const docs = [
    ...new Set([...records.values()].flatMap((one) => one.attrs['mmsi_history']?.src ?? [])),
  ];
  const pagesOf = new Map<string, Page[]>();
  for (const one of (
    await reader.query(
      'SELECT document_id AS document, page, text FROM public.document_text WHERE document_id = ANY($1::text[])',
      [docs],
    )
  ).rows.map((row) =>
    z.object({ document: z.string(), page: z.number(), text: z.string() }).parse(row),
  ))
    pagesOf.set(one.document, [...(pagesOf.get(one.document) ?? []), one]);
  return planAllHistory(acts, records, pagesOf);
};

const limitOf = (): number => {
  const at = argv.indexOf('--limit');
  const given = at < 0 ? 1 : Number(argv[at + 1]);
  if (!Number.isInteger(given) || given < 1)
    throw new Error('--limit takes a whole number, 1 or more');
  return given;
};

const flagOf = (name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at < 0 ? undefined : argv[at + 1];
};

const bareRow = z.object({ id: z.string(), type: z.string(), attrs: recordRow.shape.attrs });

// A rejected act is read only on request: the operator may have rejected it because the number
// is wrong, and the script does not know why.
export const readBare = async (
  reader: Session,
  withRejected: boolean,
  since: string,
): Promise<{ entity: Recorded; plan: Plan<Fix> }[]> => {
  const entities = (
    await reader.query(
      `SELECT e.id::text AS id, e.type, e.attrs FROM api.entity e
        WHERE e.created_at >= $1::date
          AND ((e.type = 'vessel' AND NOT e.attrs ? 'imo')
            OR (e.type = 'company' AND NOT e.attrs ? 'imo_company_number'))
        ORDER BY e.id`,
      [since],
    )
  ).rows.map((one) => bareRow.parse(one) as Recorded);
  const out: { entity: Recorded; plan: Plan<Fix> }[] = [];
  for (const entity of entities) {
    const key = entity.type === 'vessel' ? 'imo' : 'imo_company_number';
    const carriers = (
      await reader.query(
        readActsSql(
          "p.status = ANY($4::text[]) AND p.target_id = $2::uuid AND p.payload->'attrs' ? $3",
        ),
        [[key], entity.id, key, withRejected ? ['pending', 'rejected'] : ['pending']],
      )
    ).rows.map((one) => carrierOf(actRow.parse(one)));
    const [first] = carriers;
    if (first === undefined) continue;
    const value = elementsOf(attrsOf(first)[key]?.v)[0];
    const held = new Map<string, string[]>();
    if (value !== undefined)
      held.set(
        value,
        (
          await reader.query("SELECT id::text AS id FROM api.entity WHERE attrs->$1->>'v' = $2", [
            key,
            value,
          ])
        ).rows.map((one) => z.object({ id: z.string() }).parse(one).id),
      );
    out.push({ entity, plan: planBare(entity, carriers, held) });
  }
  return out;
};

const count = (reasons: readonly string[]): [string, number][] => {
  const found = new Map<string, number>();
  for (const one of reasons) found.set(one, (found.get(one) ?? 0) + 1);
  return [...found];
};

const main = async (): Promise<number> => {
  const write = argv.includes('--write');
  const only = flagOf('--class');
  if (only !== undefined && only !== 'history' && only !== 'bare')
    throw new Error('--class takes history or bare');
  const limit = limitOf();
  const since = flagOf('--since') ?? new Date().toISOString().slice(0, 10);
  const pool = new Pool({ connectionString: connectionString('app'), statement_timeout: 300_000 });
  const writer = new Pool({ connectionString: connectionString('research') });
  try {
    const doors = doorsOf(writer, pool);
    const show = (done: Result): void =>
      console.log(
        `${done.status}\t${done.key}\t${String(done.sent)} sent\t${String(done.rejected)} rejected` +
          (done.reason === undefined ? '' : `\t${done.reason}`),
      );
    if (only === undefined || only === 'history') {
      const found = await readHistory(pool);
      console.log(`${write ? 'write' : 'dry run'} history: ${String(found.length)} acts`);
      for (const one of found)
        console.log(
          `act\t${one.act.id}\t${one.act.targetId ?? '-'}\t` +
            (one.plan.kind === 'hold'
              ? one.plan.reason
              : `ready${one.plan.value.left.length > 0 ? `\tleft out: ${one.plan.value.left.join(',')}` : ''}`),
        );
      for (const [reason, n] of count(
        found.flatMap((one) => (one.plan.kind === 'hold' ? [one.plan.reason] : [])),
      ))
        console.log(`held\t${String(n)}\t${reason}`);
      const ready = found.flatMap((one) => (one.plan.kind === 'send' ? [one.plan.value] : []));
      console.log(`ready\t${String(ready.length)}`);
      console.log(
        `call_sign left out\t${String(ready.filter((one) => one.left.includes('call_sign')).length)}`,
      );
      if (write) for (const fix of ready.slice(0, limit)) show(await replace(fix, doors));
    }
    if (only === undefined || only === 'bare') {
      const found = await readBare(pool, argv.includes('--with-rejected'), since);
      console.log(
        `${write ? 'write' : 'dry run'} bare: ${String(found.length)} entities since ${since}`,
      );
      for (const one of found)
        console.log(
          `entity\t${one.entity.id}\t${one.entity.type}\t` +
            (one.plan.kind === 'hold'
              ? one.plan.reason
              : `ready${one.plan.value.left.length > 0 ? `\tleft out: ${one.plan.value.left.join(',')}` : ''}`),
        );
      for (const [reason, n] of count(
        found.flatMap((one) => (one.plan.kind === 'hold' ? [one.plan.reason] : [])),
      ))
        console.log(`held\t${String(n)}\t${reason}`);
      const ready = found.flatMap((one) => (one.plan.kind === 'send' ? [one.plan.value] : []));
      console.log(`ready\t${String(ready.length)}`);
      if (write) for (const fix of ready.slice(0, limit)) show(await replace(fix, doors));
    }
    return 0;
  } finally {
    await pool.end();
    await writer.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
