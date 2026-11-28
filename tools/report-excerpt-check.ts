// The excerpt check of the facts that the report cites, on a data release. Read only.
//
//   node tools/report-excerpt-check.ts [<release folder>] [--out <file.jsonl>]
//
// The facts: the record entity of each report node, each condition of a node that the record
// states (state "record"), each relation between two nodes, and each identifier that a note names
// beside a record document. A fact passes when one stored excerpt of the release holds the value,
// both ends of the relation, or the identifier. With no folder, it reads the release of the report.

import { readFileSync, writeFileSync } from 'node:fs';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { findExcerpt } from '@gab/tools/excerpt';

import edges from '../src/features/report/edges-data.ts';
import nodes from '../src/features/report/nodes-data.ts';
import {
  nodeMembers,
  readRelease,
  reportRelease,
  valuesOf,
  type ReleaseFiles,
} from './critical-nodes-replay.ts';
import { claimsOf, holdsIdentifier, identifiersOf, type Claim } from './node-audit-checks.ts';

type Row = Readonly<Record<string, string>>;

export interface Check {
  readonly fact: 'node_entry' | 'condition' | 'edge' | 'note';
  /** The node id, the pair of node ids, or the note number. */
  readonly ref: string;
  readonly document: string;
  readonly verdict: 'pass' | 'fail' | 'cannot_check';
  readonly reason: string;
}

export interface ReportFacts {
  readonly nodes: readonly Row[];
  readonly edges: readonly Row[];
  /** The text of each note, by its number. */
  readonly notes: ReadonlyMap<string, string>;
  /** The record documents of each note, by its number. */
  readonly noteDocuments: ReadonlyMap<string, readonly string[]>;
}

const ACT_LINKS = new Set(['designated_by', 'restricted_by', 'exempted_by']);

/** Names that a stored page of the report writes and that the record does not hold yet, by the
 * label of the entity: a name in Cyrillic, a short form that the page defines, a port. Each one was
 * read on its page (step 4 of the excerpt check, 2026-11-28). shortcut: a list in code; move each
 * name to the record as an alias when the record takes it. */
const PAGE_NAMES: Readonly<Record<string, readonly string[]>> = {
  'VTB Bank': ['Банк ВТБ'],
  'VTB Bank (Kazakhstan)': ['Банк ВТБ (Казахстан)'],
  Gazprombank: ['Газпромбанк'],
  'VEB.RF': ['ВЭБ.РФ'],
  'Government of the Russian Federation': ['Government of Russia', 'GoR'],
  'Nizhny Novgorod refinery': ['Кстовский НПЗ'],
  'Port of Primorsk': ['Приморск'],
  'Tambov Powder Plant': ['Tambov gunpowder plant'],
  'Longkou Pt': ['Longkou port'],
  'Beihai LNG Terminal': ['Beihai terminal'],
  'OJSC Capital Bank of Central Asia (Kyrgyzstan)': ['Capital Bank of Central Asia'],
  'Keremet bank (Kyrgyzstan)': ['Keremet Bank'],
  'PROMSVYAZBANK PUBLIC JOINT STOCK COMPANY': ['Promsvyazbank', 'PSB'],
  'IEMZ Kupol': ['Izhevsk Electromechanical Plant Kupol'],
  'Paradip Port': ['Paradip'],
  'STC (Специальный технологический центр)': ['Специальный технологический центр'],
};
const NAME_KEYS = new Set(['aliases', 'former_names', 'name_cyrillic', 'name_other']);

/** An identifier that a note names: an IMO number, an LEI, a UK list id or an EU act number. */
const NOTE_IDENTIFIER =
  /\bIMO[\s:]*(\d{7})\b|\b([A-Z0-9]{18}\d{2})\b|\b(RUS\d{3,5})\b|\((?:EU|EC|CFSP)\)\s*(?:No\s*)?(\d{2,4}\/\d{1,4})/gu;

export const noteIdentifiers = (text: string): string[] =>
  [
    ...new Set([...text.matchAll(NOTE_IDENTIFIER)].map((m) => m.slice(1).find(Boolean) ?? '')),
  ].filter((one) => one !== '' && /\d/u.test(one));

export const checkReport = (files: ReleaseFiles, facts: ReportFacts): Check[] => {
  const claims = [...claimsOf(files.claims).values()];
  const ids = identifiersOf(claims);
  const label = new Map(files.entities.map((one) => [one['id'] ?? '', one['label'] ?? '']));
  const type = new Map(files.entities.map((one) => [one['id'] ?? '', one['type'] ?? '']));
  const names = new Map<string, string[]>();
  for (const entity of files.entities) names.set(entity['id'] ?? '', [entity['label'] ?? '']);
  for (const claim of claims)
    if (claim.kind === 'attribute' && NAME_KEYS.has(claim.attribute))
      names.get(claim.subject)?.push(...safeValues(claim.value));
  for (const entity of files.entities)
    names.get(entity['id'] ?? '')?.push(...(PAGE_NAMES[entity['label'] ?? ''] ?? []));
  // The report gives its own name and short label of each node: a list writes "Primorsk".
  for (const node of facts.nodes)
    for (const one of entitiesOf(node))
      names.get(one)?.push(node['name'] ?? '', node['short_label'] ?? '');
  // The title of a page names its subject, as a page of a pipeline that writes "the pipeline", and
  // the address of a register card can hold the IMO number of its vessel.
  const excerpt = (row: Row) =>
    `${row['excerpt'] ?? ''}\n${row['document_title'] ?? ''}\n${row['document_address'] ?? ''}`;
  const names_ = (text: string, entity: string) =>
    (names.get(entity) ?? []).some((one) => one.trim() !== '' && holds(text, one)) ||
    [...(ids.get(entity)?.values() ?? [])].flat().some((one) => holdsIdentifier(text, one));
  // The vessels of a manager, or failing that of an owner, are members of its node (A.3), and a
  // node of a shipowner holds the vessels that it owns or operates. Only a vessel is a member.
  const fleet = nodeMembers(files);
  for (const one of files.relations)
    if (
      (one['type'] === 'owns' || one['type'] === 'operates') &&
      type.get(one['to_id'] ?? '') === 'vessel'
    )
      fleet.set(one['from_id'] ?? '', [
        ...(fleet.get(one['from_id'] ?? '') ?? []),
        one['to_id'] ?? '',
      ]);
  const touching = new Map<string, Claim[]>();
  for (const claim of claims)
    for (const end of claim.kind === 'relation' ? [claim.subject, claim.object] : [claim.subject])
      touching.set(end, [...(touching.get(end) ?? []), claim]);

  /** One citation states the claim: the value, or both ends (a link to an act: the subject, as
   * the cited document is the act or the list). */
  const states = (claim: Claim, row: Row): boolean => {
    const text = excerpt(row);
    if (claim.kind === 'attribute') {
      // A value must be in the excerpt itself, never only in the title or the address of the page.
      const values = safeValues(claim.value);
      return values.length > 0 && values.every((one) => holds(row['excerpt'] ?? '', one));
    }
    if (ACT_LINKS.has(claim.relationType)) return names_(text, claim.subject);
    // GAB makes the label of an event ("strike — site — day"), so no page writes it: the excerpt
    // must name the place.
    if (type.get(claim.subject) === 'event') return names_(text, claim.object);
    if (names_(text, claim.subject) && names_(text, claim.object)) return true;
    // A register page names a vessel by its IMO number in one excerpt and its manager in the next:
    // the excerpts of the claim on one page read together only when one of them gives an
    // identifier of one end.
    const page = claim.citations.filter((one) => one['document_id'] === row['document_id']);
    const byIdentifier = (entity: string) =>
      page.some((one) =>
        [...(ids.get(entity)?.values() ?? [])]
          .flat()
          .some((id) => holdsIdentifier(excerpt(one), id)),
      );
    const all = page.map(excerpt).join('\n');
    return (
      (byIdentifier(claim.subject) || byIdentifier(claim.object)) &&
      names_(all, claim.subject) &&
      names_(all, claim.object)
    );
  };
  const checks: Check[] = [];
  const add = (
    fact: Check['fact'],
    ref: string,
    document: string,
    verdict: Check['verdict'],
    reason: string,
  ) => checks.push({ fact, ref, document, verdict, reason });

  const entityOf = new Map(facts.nodes.map((node) => [node['node_id'] ?? '', entitiesOf(node)]));
  const touchingAll = (entities: readonly string[]) => [
    ...new Set(entities.flatMap((one) => touching.get(one) ?? [])),
  ];
  for (const node of facts.nodes) {
    const members = entitiesOf(node);
    for (const entity of members) {
      const ref = members.length > 1 ? `${node['node_id']}#${entity}` : (node['node_id'] ?? '');
      if (!names.has(entity)) {
        add('node_entry', ref, '', 'fail', 'entity_not_in_release');
        continue;
      }
      const own = (touching.get(entity) ?? []).flatMap((claim) => claim.citations);
      const named = own.find((row) => names_(excerpt(row), entity));
      add(
        'node_entry',
        ref,
        named?.['document_id'] ?? '',
        named ? 'pass' : 'fail',
        named ? 'an excerpt names the entity' : 'no_excerpt_names_the_entity',
      );
    }
    const ref = node['node_id'] ?? '';
    for (const n of ['1', '2', '3']) {
      const state = Object.entries(node).find(
        ([key]) => key.startsWith(`cond${n}_`) && key.endsWith('_state'),
      )?.[1];
      // A condition can cite more than one document: "doc_a; doc_b".
      const documents = (node[`cond${n}_doc`] ?? '').split(/[\s;,]+/u).filter((one) => one !== '');
      const document = documents.join(';');
      if (state !== 'record' || documents.length === 0) continue;
      // The sanctions condition rests on a link to an act; the other two on any claim of the node.
      // A condition of the node of a manager can rest on a fact of one of its vessels.
      const withFleet = [...new Set(members.flatMap((one) => [one, ...(fleet.get(one) ?? [])]))];
      const cited = touchingAll(withFleet).filter(
        (claim) =>
          (n !== '1' || ACT_LINKS.has(claim.relationType)) &&
          claim.citations.some((row) => documents.includes(row['document_id'] ?? '')),
      );
      if (cited.length === 0)
        add(
          'condition',
          `${ref}/cond${n}`,
          document,
          'fail',
          'no_claim_of_the_node_cites_the_document',
        );
      else {
        const ok = cited.some((claim) =>
          claim.citations.some(
            (row) => documents.includes(row['document_id'] ?? '') && states(claim, row),
          ),
        );
        add(
          'condition',
          `${ref}/cond${n}`,
          document,
          ok ? 'pass' : 'fail',
          ok ? 'an excerpt states the claim' : 'excerpt_does_not_state_the_claim',
        );
      }
    }
  }

  for (const edge of facts.edges) {
    if (edge['state'] !== 'promoted fact') continue;
    const [from, to] = [
      entityOf.get(edge['source'] ?? '') ?? [],
      entityOf.get(edge['target'] ?? '') ?? [],
    ];
    const ref = `${edge['source']}>${edge['target']}`;
    const documents = (edge['document_ids'] ?? '').split(';').filter(Boolean);
    const via = edge['via_shared_entity'] ?? '';
    const ends = (claim: Claim, group: readonly string[]) =>
      group.includes(claim.subject) || group.includes(claim.object);
    const between = touchingAll([...from, ...to]).filter(
      (claim) =>
        claim.kind === 'relation' &&
        // A type of an edge to a shared entity carries its direction: "crude_flows_to (in)".
        claim.relationType === (edge['relation_type'] ?? '').replace(/\s*\((?:in|out)\)$/u, '') &&
        // An edge through a shared entity holds the relation of one node to that entity.
        (via === ''
          ? ends(claim, from) && ends(claim, to)
          : (ends(claim, from) || ends(claim, to)) &&
            [claim.subject, claim.object].some(
              (one) => plainName(label.get(one) ?? '') === plainName(via),
            )),
    );
    if (between.length === 0) {
      add('edge', ref, documents.join(';'), 'fail', 'relation_not_in_release');
      continue;
    }
    const row = between.flatMap((claim) => claim.citations.filter((one) => states(claim, one)))[0];
    add(
      'edge',
      ref,
      row?.['document_id'] ?? documents.join(';'),
      row ? 'pass' : 'fail',
      row ? 'an excerpt names both ends' : 'no_excerpt_names_both_ends',
    );
  }

  const byDocument = new Map<string, Row[]>();
  for (const row of files.claims) {
    const id = row['document_id'] ?? '';
    byDocument.set(id, [...(byDocument.get(id) ?? []), row]);
  }
  for (const [note, documents] of facts.noteDocuments) {
    const text = facts.notes.get(note);
    if (text === undefined) continue;
    for (const identifier of noteIdentifiers(text)) {
      const rows = documents.flatMap((one) => byDocument.get(one) ?? []);
      const held = rows.find((row) => holdsIdentifier(excerpt(row), identifier));
      if (rows.length === 0)
        add('note', note, documents.join(';'), 'cannot_check', `no_release_excerpt:${identifier}`);
      else
        add(
          'note',
          note,
          held?.['document_id'] ?? documents.join(';'),
          held ? 'pass' : 'fail',
          held ? `an excerpt holds ${identifier}` : `identifier_not_in_excerpt:${identifier}`,
        );
    }
  }
  return checks;
};

/** The record entities of a node: a group node holds its ids joined by ";". */
const entitiesOf = (node: Row): string[] =>
  (node['record_entity_id'] ?? '')
    .split(';')
    .map((one) => one.trim())
    .filter((one) => one !== '');

/** The text holds the words. A list writes "SOVCOMFLOT", so the case does not count, but then the
 * words must start and end at a word edge: "RU" is not in "Russia". */
export const holds = (text: string, words: string): boolean => {
  if (findExcerpt(text, words) !== null) return true;
  const body = words.trim().replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  if (body !== '' && new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'iu').test(text))
    return true;
  // "CJSC Alfa Bank Belarus" is "Alfa-Bank (Belarus)", and "TSK VEKTOR, OOO" is "TSK Vektor".
  const name = plainName(words);
  return name.length >= 4 && ` ${plainName(text)} `.includes(` ${name} `);
};

const LEGAL_FORMS = new Set(
  'llc jsc pjsc ojsc cjsc ooo oao pao zao ao ltd limited inc co corp plc the'.split(' '),
);
/** A name in lower case, with no punctuation and no legal form. */
export const plainName = (text: string): string =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '' && !LEGAL_FORMS.has(word))
    .join(' ');

const safeValues = (value: string): string[] => {
  try {
    return valuesOf(value);
  } catch {
    return [];
  }
};

/** The notes of the Markdown text, `[^N]: ...`, by number. */
export const notesOf = (markdown: string): Map<string, string> =>
  new Map([...markdown.matchAll(/^\[\^(\w+)\]:\s*(.+)$/gmu)].map((m) => [m[1] ?? '', m[2] ?? '']));

if (argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  });
  const folder = positionals[0] ?? (await reportRelease());
  const root = new URL('../src/features/report/', import.meta.url);
  const noteFile = JSON.parse(readFileSync(new URL('data/note-documents.json', root), 'utf8')) as {
    notes: { id: string; documents: { id: string }[] }[];
  };
  const checks = checkReport(readRelease(folder), {
    nodes,
    edges,
    notes: notesOf(readFileSync(new URL('source/report-en.md', root), 'utf8')),
    noteDocuments: new Map(
      noteFile.notes.map((note) => [note.id, note.documents.map((one) => one.id)]),
    ),
  });
  if (values.out !== undefined)
    writeFileSync(values.out, checks.map((one) => JSON.stringify(one)).join('\n') + '\n');
  const tally = new Map<string, number>();
  for (const one of checks)
    tally.set(`${one.fact} ${one.verdict}`, (tally.get(`${one.fact} ${one.verdict}`) ?? 0) + 1);
  console.log(JSON.stringify(Object.fromEntries([...tally].sort()), null, 2));
  for (const one of checks.filter((c) => c.verdict !== 'pass'))
    console.log(`${one.fact}\t${one.ref}\t${one.document}\t${one.verdict}\t${one.reason}`);
}
