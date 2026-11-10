// Replays a stated rule of the critical nodes of the report on the record, read only.
//
// This script does NOT reproduce the published count of 493 (450 + 43). That count comes from a
// selection test of the author on 27 October 2026. The query of that test is not in the
// repository, and the record has grown since. The script states one rule in the words of the
// method annex (A.3) and counts what the record gives today, so a reader can check a figure.
// Run: `node tools/critical-nodes-replay.ts` (the stack must run; `pnpm stack:up`).

import { readFileSync } from 'node:fs';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { connectionString } from './db-runtime.ts';

/** A country that applies the sanctions of the coalition (the EU, the United States, the United
 * Kingdom and their allies). The report names no list, so this list is the choice of this script,
 * not a policy. */
export const COALITION = new Set(
  `AL AT AU BE BG CA CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT JP KR LI LT LU LV MD ME MK MT
  NL NO NZ PL PT RO SE SI SK UA US`.split(/\s+/),
);

export interface NodeFacts {
  readonly id: string;
  /** Condition (a): the node itself has a designation. */
  readonly designated: boolean;
  /** Condition (b): a relation of the node is dated in 2024-2026, a designation not counted. */
  readonly active: boolean;
  /** The ISO codes of the registration country and of the flags of its vessels. */
  readonly countries: readonly string[];
}

export interface Counts {
  readonly nodes: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly all3: number;
  readonly atLeast2: number;
}

/** The counts of a list of nodes. Condition (c) needs one country outside the coalition. */
export const rebuild = (facts: readonly NodeFacts[]): Counts => {
  const rows = facts.map((one) => ({
    a: one.designated,
    b: one.active,
    c: one.countries.some((code) => !COALITION.has(code)),
  }));
  const met = (row: { a: boolean; b: boolean; c: boolean }) =>
    Number(row.a) + Number(row.b) + Number(row.c);
  return {
    nodes: rows.length,
    a: rows.filter((one) => one.a).length,
    b: rows.filter((one) => one.b).length,
    c: rows.filter((one) => one.c).length,
    all3: rows.filter((one) => met(one) === 3).length,
    atLeast2: rows.filter((one) => met(one) >= 2).length,
  };
};

// A.3 as written: (a) the node, or a vessel it manages, has a designation, or a designated entity
// holds 50% or more of it; (b) a relation of the node or of a vessel it manages has a start or an end
// date in 2024-2026, a designation included; (c) the registration country, or the flag of a vessel it
// manages, is outside the coalition. The vessels of one manager form one node, and a vessel with no
// manager is a node of its own.
// shortcut: no counterparty country (the record has none as an attribute), no owner
// fallback for the grouping of vessels and no owner chain beyond one step. Upgrade when the author states them.
export const SQL = `
  with node_of as (
    select e.id as member, coalesce(
      (select r.src_id from relations r where r.type = 'operates' and r.dst_id = e.id
        and r.valid_to is null order by r.src_id limit 1),
      e.id) as node
    from entities e),
  dated as (
    select r.src_id, r.dst_id from relations r
    where (r.valid_from is not null or r.valid_to is not null)
      and (r.valid_from between date '2024-01-01' and date '2026-12-31'
        or r.valid_to between date '2024-01-01' and date '2026-12-31')),
  country as (
    select e.id, (select a.code from area_code a where a.system = 'iso3166'
      and (a.code = v or a.label = v) limit 1) as code
    from entities e
    cross join lateral (select coalesce(
      e.attrs -> 'registration_jurisdiction' ->> 'v',
      (select s.label from relations f join entities s on s.id = f.src_id
        where f.type = 'flags' and f.dst_id = e.id limit 1)) as v) j)
  select n.node::text as id,
    bool_or(
      exists (select 1 from relations r where r.type = 'designated_by' and r.src_id = n.member)
      or exists (select 1 from relations o
        join relations d on d.type = 'designated_by' and d.src_id = o.src_id
        where o.type = 'owns' and o.dst_id = n.member
          and (select max(case when x ~ '^[0-9]+([.,][0-9]+)?$' then replace(x, ',', '.')::numeric end)
            from unnest(array[o.attrs -> 'share_percent' ->> 'v', o.attrs -> 'share_pct' ->> 'v']) x) >= 50)) as designated,
    bool_or(exists (select 1 from dated d where d.src_id = n.member or d.dst_id = n.member)) as active,
    coalesce(array_agg(distinct c.code) filter (where c.code is not null), '{}') as countries
  from node_of n join country c on c.id = n.member
  group by n.node`;

/** The published split, from the dated data file of the report: the record and the first list. */
export const published = (csv: string) => {
  const [head, ...lines] = csv.trim().split('\n');
  const names = (head ?? '').split(',');
  const sum = (name: string) =>
    lines.reduce((total, line) => total + Number(line.split(',')[names.indexOf(name)]), 0);
  return { record: sum('record'), listOnly: sum('list_only') };
};

const main = async () => {
  const client = new Client({
    connectionString: connectionString('superuser'),
    options: '-c default_transaction_read_only=on',
  });
  await client.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      designated: boolean;
      active: boolean;
      countries: string[];
    }>(SQL);
    const csv = readFileSync(
      fileURLToPath(new URL('../src/features/report/data/critical-layers.csv', import.meta.url)),
      'utf8',
    );
    console.log(JSON.stringify({ published: published(csv), rebuilt: rebuild(rows) }, null, 2));
  } finally {
    await client.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) await main();
