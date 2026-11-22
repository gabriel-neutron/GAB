// Counts the critical nodes of the report on a data release, read only.
//
// The count of the report is the result of this script on the release `data-2026-10-28`, the
// release that the report names. No database is necessary: the script downloads the release,
// checks its SHA-256 and reads entities.csv, relations.csv and claims.csv. Only the release counts:
// a node that the release does not hold is not in the count.
//
// The rule (Annex A.3 of the report states the same rule):
// - Node. A vessel goes to the node of its current manager, or failing that of its current owner.
//   A vessel with neither is a node of its own. Each other entity is a node, and an act or an event
//   is no node. A node meets a condition when one of its members meets it.
// - (a) Exposed to sanctions: a designation relation, or a holding of 50% or more by an entity
//   that has its own designation.
// - (b) Active in 2024-2026: a relation with a start or an end date in the period. A designation
//   with no date takes the date of its act (entry into force, adoption, or the OFAC action). An
//   event with a date in the period makes the place where it occurred active.
// - (c) Passes through a third country: the country of registration, the country, any flag that
//   the release gives (a flag has no date), or one of these of a direct counterparty, is a country
//   other than Russia that is not in COALITION. A counterparty is the other end of a relation that
//   is not a legal act, a subordination or a relation of unknown type. An address or a name gives
//   no country.
// - Critical: (a), (b) and (c). On an official source: each condition rests on at least one fact
//   whose claim cites a document of ADMIRALTY letter A (for a counterparty, the relation and the
//   country both).
// - Layer (derived by this script, no field of the release): Finance when a member is a bank; Pay
//   when a member is a vessel, a port or an energy facility, trades oil, or owns or operates such an
//   asset; Fight for each other node.
// Run: `pnpm critical:replay` (or `node tools/critical-nodes-replay.ts <folder of a release>`).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCsv } from '@gab/release/csv';

import { fetchDataRelease } from './data-release.ts';

/** The release that the report names, and the SHA-256 of its release.tar.gz. */
export const REPORT_RELEASE = {
  tag: 'data-2026-10-28',
  sha256: '8896410d0eaea285c72e28798ae1fa7c5ea57d0f369dad3791c0acda04101084',
} as const;

/** A country that applies the sanctions of the coalition (the EU, the United States, the United
 * Kingdom and their allies). The report names no list, so this list is the choice of this script.
 * Russia is not a third country: it is the target of the sanctions. */
export const COALITION = new Set(
  `AL AT AU BE BG CA CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT JP KR LI LT LU LV MD ME MK MT
  NL NO NZ PL PT RO SE SI SK UA US`.split(/\s+/),
);
const TARGET = 'RU';

const FROM = '2024-01-01';
const TO = '2026-12-31';

/** The attributes that give the country of an entity. An address or a name does not count. */
const COUNTRY_ATTRIBUTES = new Set(['registration_jurisdiction', 'country', 'flag_history']);

/** The relations that do not make a counterparty: a legal act, a structure of the state, or a
 * relation with no stated type. */
const NOT_A_COUNTERPARTY = new Set([
  'designated_by',
  'restricted_by',
  'exempted_by',
  'subordinate_to',
  'unknown',
]);

/** The relations of a node that put it in the pay layer: energy assets and their trade. */
const PAY_RELATIONS = new Set([
  'crude_flows_to',
  'products_flow_to',
  'sells_products_to',
  'supplies_crude_to',
  'loads_at',
  'discharges_at',
  'berthed_at',
  'sts_with',
  'charters',
]);

// The names of a country in the release that Intl.DisplayNames does not give.
const COUNTRY_ALIASES: Record<string, string> = {
  'hong kong': 'HK',
  'people’s republic of china': 'CN',
  "people's republic of china": 'CN',
  turkey: 'TR',
  türkiye: 'TR',
  'antigua and barbuda': 'AG',
  'kyrgyz republic': 'KG',
  gambia: 'GM',
  'united states of america': 'US',
  'u.a.e.': 'AE',
  'st vincent': 'VC',
  russian: 'RU',
  'us-de': 'US',
};

const DISPLAY = new Intl.DisplayNames(['en'], { type: 'region' });
const NAMES = new Map<string, string>();
for (let first = 65; first <= 90; first += 1)
  for (let second = 65; second <= 90; second += 1) {
    const code = String.fromCharCode(first, second);
    const name = DISPLAY.of(code);
    if (name !== undefined && name !== code) NAMES.set(name.toLowerCase(), code);
  }

/** The ISO codes of one value of a country attribute, or none. A value can be a JSON list. */
export const countryCodes = (value: string): string[] => {
  const values = value.startsWith('[') ? (JSON.parse(value) as string[]) : [value];
  return values.flatMap((one) => {
    if (/^[A-Z]{2}$/.test(one)) return [one];
    const name = one
      .trim()
      .toLowerCase()
      .replace(/^(the|kingdom of|(democratic )?(socialist )?republic of)\s+/, '');
    const code = COUNTRY_ALIASES[name] ?? NAMES.get(name);
    return code === undefined ? [] : [code];
  });
};

type Row = Readonly<Record<string, string>>;

/** The rows of a release CSV file. The comment lines of its head are not rows. */
export const releaseRows = (text: string): Row[] => {
  const records = readCsv(text)
    .map((one) => one.fields)
    .filter((fields) => !(fields[0] ?? '').replace('﻿', '').startsWith('#'));
  const [head = [], ...body] = records;
  return body.map((fields) => Object.fromEntries(head.map((name, at) => [name, fields[at] ?? ''])));
};

export interface ReleaseFiles {
  readonly entities: readonly Row[];
  readonly relations: readonly Row[];
  readonly claims: readonly Row[];
}

export type Layer = 'Pay' | 'Finance' | 'Fight';

export interface NodeResult {
  readonly id: string;
  readonly layer: Layer;
  readonly a: boolean;
  readonly b: boolean;
  readonly c: boolean;
  /** Each condition rests on at least one fact that a document of ADMIRALTY letter A supports. */
  readonly official: boolean;
}

const inPeriod = (day: string) => day !== '' && day >= FROM && day <= TO;

/** The date of an act from its attributes: entry into force, adoption, or the OFAC action. */
const actDay = (attributes: ReadonlyMap<string, string>): string => {
  const day =
    attributes.get('entry_into_force') ??
    attributes.get('adopted_on') ??
    attributes.get('ofac_action_id') ??
    '';
  return /^\d{8}$/.test(day) ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}` : day;
};

const share = (text: string) => {
  const found = /([\d.]+)\s*%/.exec(text);
  return found === null ? 0 : Number(found[1]);
};

/** Applies the rule of docs/critical-nodes.md to the files of one release. */
export const replay = ({ entities, relations, claims }: ReleaseFiles): NodeResult[] => {
  const type = new Map(entities.map((one) => [one['id'] ?? '', one['type'] ?? '']));

  // The attributes of each entity, and the facts that a document of letter A supports.
  const attributes = new Map<string, Map<string, string>>();
  const countries = new Map<string, { code: string; official: boolean }[]>();
  const officialRelation = new Set<string>();
  for (const claim of claims) {
    const subject = claim['subject_id'] ?? '';
    const official = claim['nato_letter'] === 'A';
    if (claim['claim_kind'] === 'relation') {
      if (official)
        officialRelation.add(
          `${subject} ${claim['relation_type'] ?? ''} ${claim['object_id'] ?? ''}`,
        );
      continue;
    }
    const name = claim['attribute'] ?? '';
    const value = claim['value'] ?? '';
    const own = attributes.get(subject) ?? new Map<string, string>();
    if (!own.has(name)) own.set(name, value);
    attributes.set(subject, own);
    if (COUNTRY_ATTRIBUTES.has(name)) {
      const list = countries.get(subject) ?? [];
      for (const code of countryCodes(value)) list.push({ code, official });
      countries.set(subject, list);
    }
  }
  const officialOf = (relation: Row) =>
    officialRelation.has(
      `${relation['from_id'] ?? ''} ${relation['type'] ?? ''} ${relation['to_id'] ?? ''}`,
    );

  // The node of each entity: a vessel goes to its manager, or failing that to its owner.
  const pick = (kind: string) => {
    const found = new Map<string, string>();
    for (const one of relations)
      if (
        one['type'] === kind &&
        type.get(one['to_id'] ?? '') === 'vessel' &&
        one['valid_to'] === ''
      ) {
        const vessel = one['to_id'] ?? '';
        const holder = one['from_id'] ?? '';
        if (!found.has(vessel) || holder < (found.get(vessel) ?? '')) found.set(vessel, holder);
      }
    return found;
  };
  const manager = pick('operates');
  const owner = pick('owns');
  const nodeOf = (id: string) => manager.get(id) ?? owner.get(id) ?? id;

  const members = new Map<string, string[]>();
  for (const { id = '', type: kind = '' } of entities) {
    if (kind === 'legal_act' || kind === 'event') continue;
    const node = nodeOf(id);
    members.set(node, [...(members.get(node) ?? []), id]);
  }

  // The facts of each member for the three conditions: a value is "official" when a document of
  // letter A supports it.
  const designated = new Map<string, boolean>();
  const active = new Map<string, boolean>();
  const third = new Map<string, boolean>();
  const mark = (into: Map<string, boolean>, id: string, official: boolean) =>
    into.set(id, (into.get(id) ?? false) || official);
  const isThird = (code: string) => code !== TARGET && !COALITION.has(code);

  for (const [id, list] of countries)
    for (const { code, official } of list) if (isThird(code)) mark(third, id, official);

  for (const relation of relations) {
    const from = relation['from_id'] ?? '';
    const to = relation['to_id'] ?? '';
    const kind = relation['type'] ?? '';
    const official = officialOf(relation);
    if (kind === 'designated_by') mark(designated, from, official);
    let dated = inPeriod(relation['valid_from'] ?? '') || inPeriod(relation['valid_to'] ?? '');
    if (kind === 'designated_by' && relation['valid_from'] === '' && relation['valid_to'] === '')
      dated = inPeriod(actDay(attributes.get(to) ?? new Map()));
    if (dated) {
      mark(active, from, official);
      if (type.get(to) !== 'legal_act') mark(active, to, official);
    }
    if (!NOT_A_COUNTERPARTY.has(kind))
      for (const [self, other] of [
        [from, to],
        [to, from],
      ] as const)
        for (const { code, official: sure } of countries.get(other) ?? [])
          if (isThird(code)) mark(third, self, official && sure);
  }
  // A holding of 50% or more by an entity that has its own designation: one step, so the order of
  // the rows does not change the result.
  const ownDesignation = new Map(designated);
  for (const relation of relations) {
    const holder = ownDesignation.get(relation['from_id'] ?? '');
    if (relation['type'] === 'owns' && share(relation['share'] ?? '') >= 50 && holder !== undefined)
      mark(designated, relation['to_id'] ?? '', holder && officialOf(relation));
  }
  // An event dated in the period makes the place where it occurred active.
  for (const relation of relations)
    if (relation['type'] === 'occurred_at') {
      const day = attributes.get(relation['from_id'] ?? '')?.get('occurred_on') ?? '';
      if (inPeriod(day)) mark(active, relation['to_id'] ?? '', officialOf(relation));
    }

  const payMember = new Set<string>();
  for (const { id = '', type: kind = '' } of entities)
    if (
      kind === 'vessel' ||
      kind === 'port' ||
      (kind === 'facility' && attributes.get(id)?.has('asset_kind') === true)
    )
      payMember.add(id);
  for (const relation of relations) {
    const kind = relation['type'] ?? '';
    const to = relation['to_id'] ?? '';
    if (PAY_RELATIONS.has(kind)) payMember.add(relation['from_id'] ?? '');
    if ((kind === 'owns' || kind === 'operates') && payMember.has(to) && type.get(to) !== 'company')
      payMember.add(relation['from_id'] ?? '');
  }

  return [...members].map(([id, list]) => {
    const any = (from: Map<string, boolean>) => list.some((one) => from.has(one));
    const sure = (from: Map<string, boolean>) => list.some((one) => from.get(one) === true);
    const layer: Layer = list.some((one) => type.get(one) === 'bank')
      ? 'Finance'
      : list.some((one) => payMember.has(one))
        ? 'Pay'
        : 'Fight';
    return {
      id,
      layer,
      a: any(designated),
      b: any(active),
      c: any(third),
      official: sure(designated) && sure(active) && sure(third),
    };
  });
};

export interface Count {
  readonly critical: number;
  readonly official: number;
  readonly byLayer: Readonly<Record<Layer, number>>;
}

/** The critical nodes (all three conditions) and those on an official source, by layer. */
export const count = (nodes: readonly NodeResult[]): Count => {
  const critical = nodes.filter((one) => one.a && one.b && one.c);
  const byLayer = { Pay: 0, Finance: 0, Fight: 0 };
  for (const one of critical) byLayer[one.layer] += 1;
  return {
    critical: critical.length,
    official: critical.filter((one) => one.official).length,
    byLayer,
  };
};

/** Reads the three files of a release folder. */
export const readRelease = (folder: string): ReleaseFiles => {
  const read = (name: string) => releaseRows(readFileSync(join(folder, name), 'utf8'));
  return {
    entities: read('entities.csv'),
    relations: read('relations.csv'),
    claims: read('claims.csv'),
  };
};

/** The folder of the release of the report, downloaded once and checked. */
export const reportRelease = () =>
  fetchDataRelease(
    resolve(fileURLToPath(new URL('..', import.meta.url))),
    REPORT_RELEASE.tag,
    REPORT_RELEASE.sha256,
  );

if (argv[1] === fileURLToPath(import.meta.url)) {
  const folder = argv[2] ?? (await reportRelease());
  console.log(JSON.stringify(count(replay(readRelease(folder))), null, 2));
}
