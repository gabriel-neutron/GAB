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
  const names = new Map<string, string[]>();
  for (const entity of files.entities) names.set(entity['id'] ?? '', [entity['label'] ?? '']);
  for (const claim of claims)
    if (claim.kind === 'attribute' && NAME_KEYS.has(claim.attribute))
      names.get(claim.subject)?.push(...safeValues(claim.value));
  // The report gives its own name and short label of each node: a list writes "Primorsk".
  for (const node of facts.nodes)
    for (const one of entitiesOf(node))
      names.get(one)?.push(node['name'] ?? '', node['short_label'] ?? '');
  const excerpt = (row: Row) => row['excerpt'] ?? '';
  const names_ = (text: string, entity: string) =>
    (names.get(entity) ?? []).some((one) => one.trim() !== '' && findExcerpt(text, one) !== null) ||
    [...(ids.get(entity)?.values() ?? [])].flat().some((one) => holdsIdentifier(text, one));
  const touching = new Map<string, Claim[]>();
  for (const claim of claims)
    for (const end of claim.kind === 'relation' ? [claim.subject, claim.object] : [claim.subject])
      touching.set(end, [...(touching.get(end) ?? []), claim]);

  /** One citation states the claim: the value, or both ends (a link to an act: the subject, as
   * the cited document is the act or the list). */
  const states = (claim: Claim, row: Row): boolean => {
    const text = excerpt(row);
    if (claim.kind === 'attribute') {
      const values = safeValues(claim.value);
      return values.length > 0 && values.every((one) => findExcerpt(text, one) !== null);
    }
    if (!names_(text, claim.subject)) return false;
    return ACT_LINKS.has(claim.relationType) || names_(text, claim.object);
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
      const document = node[`cond${n}_doc`] ?? '';
      if (state !== 'record' || document === '') continue;
      const cited = touchingAll(members).filter((claim) =>
        claim.citations.some((row) => row['document_id'] === document),
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
          claim.citations.some((row) => row['document_id'] === document && states(claim, row)),
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
            [claim.subject, claim.object].some((one) => label.get(one) === via)),
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
      const held = rows.find(
        (row) => holdsIdentifier(excerpt(row), identifier) || excerpt(row).includes(identifier),
      );
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
