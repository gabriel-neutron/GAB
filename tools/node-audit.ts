// The strict audit of the nodes, one node at a time, with the same checks for each node. Read only.
// Checks and method: tools/node-audit-checks.ts. Run book: infra/vps/README.md, "The node audit".
//
// pnpm node:audit [--out <folder>] [--limit <n>] [--only-report-nodes]
//                 [--record [--tunnel <file>] [--local-check <file>]]
//                 [--model --token-cap <n> [--go]]
//
// The order: the nodes that the report pages name (src/features/report/nodes-data.ts), then the other
// critical nodes of the replay, then each other node, by node id in each group. After each node, one
// line goes to <out>/results.jsonl, so a stopped run starts again at the next node. Release mode reads
// each cited document at its public address, and lists each one that it cannot read in
// <out>/local-check.txt; --record --local-check <that file> on the PC audits only their nodes.

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { argv, env, exit, platform } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  openBudget,
  openModel,
  openrouterModel,
  readModelConfig,
  type Message,
  type ModelConfig,
} from '@gab/model';
import { checkAnswer, verdictsOf } from '@gab/tools/check-answer';
import { hostGuards } from '@gab/tools/host-lease';
import type { CheckVerdict } from '@gab/tools/tool';

import {
  claimedDays,
  count,
  countryCodes,
  nodeMembers,
  readRelease,
  replay,
  REPORT_RELEASE,
  reportRelease,
  type ReleaseFiles,
} from './critical-nodes-replay.ts';
import {
  claimsOf,
  dates,
  denyList,
  designationSource,
  duplicatesOf,
  excerptAtSource,
  excerptPresent,
  FACT_CHECKS,
  farEndsOf,
  identifiersOf,
  identifierValid,
  NODE_CHECKS,
  nodeChecks,
  nodeVerdict,
  originKind,
  recordChecks,
  sha256Of,
  valueInExcerpt,
  type Claim,
  type RecordReader,
  type Result,
  type SourceReader,
} from './node-audit-checks.ts';
import { LOCAL_CHECK, localCheckIds, localCheckLines, sourceReader } from './node-audit-source.ts';
import { tunnelConnection } from './record-tunnel-env.ts';

/** The version of the checks. A result file of another version is not resumed. */
export const AUDIT_VERSION = 3;

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The nodes that the report pages name. The file is data of the site, outside the project of the
 * tools, so its text is read and not imported. */
const REPORT_NODES = join(ROOT, 'src/features/report/nodes-data.ts');

/** The record ids of the report nodes. A group node holds its ids joined by ";". */
export const reportEntityIds = (text: string): string[] =>
  [...text.matchAll(/record_entity_id:\s*'([^']*)'/gu)]
    .flatMap((one) => (one[1] ?? '').split(';'))
    .map((one) => one.trim())
    .filter((one) => one !== '');

/** The report nodes that give no country (code XX) while the release gives a country of one of
 * their entities (registration_jurisdiction or country). Each one is a fault of the node list. */
export const reportCountryGaps = (text: string, claims: ReleaseFiles['claims']): string[] => {
  const countries = new Map<string, string[]>();
  for (const claim of claims) {
    const name = claim['attribute'] ?? '';
    if (claim['subject_kind'] === 'relation') continue;
    if (name !== 'registration_jurisdiction' && name !== 'country') continue;
    const subject = claim['subject_id'] ?? '';
    countries.set(subject, [
      ...(countries.get(subject) ?? []),
      ...countryCodes(claim['value'] ?? ''),
    ]);
  }
  const gaps: string[] = [];
  for (const block of text.split(/(?=node_id: ')/u).slice(1)) {
    const field = (key: string) =>
      new RegExp(String.raw`${key}:\s*'([^']*)'`, 'u').exec(block)?.[1] ?? '';
    if (field('country_code') !== 'XX') continue;
    const ids = field('record_entity_id')
      .split(';')
      .map((one) => one.trim());
    const found = [...new Set(ids.flatMap((one) => countries.get(one) ?? []))].sort();
    if (found.length > 0) gaps.push(`${field('node_id')} ${found.join(' ')}`);
  }
  return gaps;
};

export type Group = 'report' | 'critical' | 'other';

export interface AuditNode {
  readonly id: string;
  readonly group: Group;
  readonly members: readonly string[];
}

/** The nodes in the order of the audit. */
export const auditOrder = (
  files: ReleaseFiles,
  reportEntities: readonly string[],
): { nodes: AuditNode[]; missingReportEntities: string[] } => {
  const members = nodeMembers(files);
  const nodeOfEntity = new Map<string, string>();
  for (const [node, list] of members) for (const one of list) nodeOfEntity.set(one, node);
  const report = new Set<string>();
  const missingReportEntities: string[] = [];
  for (const one of reportEntities) {
    const node = nodeOfEntity.get(one);
    if (node === undefined) missingReportEntities.push(one);
    else report.add(node);
  }
  const critical = new Set(
    replay(files)
      .filter((one) => one.a && one.b && one.c)
      .map((one) => one.id),
  );
  const groupOf = (id: string): Group =>
    report.has(id) ? 'report' : critical.has(id) ? 'critical' : 'other';
  const rank = { report: 0, critical: 1, other: 2 };
  const nodes = [...members]
    .map(([id, list]) => ({ id, group: groupOf(id), members: list }))
    .sort((a, b) => rank[a.group] - rank[b.group] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { nodes, missingReportEntities: [...new Set(missingReportEntities)].sort() };
};

/** What the audit knows of the whole release, built once. */
export interface Context {
  readonly mode: 'release' | 'record';
  readonly claims: ReadonlyMap<string, Claim>;
  readonly claimsOfEntity: ReadonlyMap<string, readonly Claim[]>;
  readonly identifiers: ReturnType<typeof identifiersOf>;
  readonly farEnds: ReturnType<typeof farEndsOf>;
  readonly actAttributes: ReadonlyMap<string, ReadonlySet<string>>;
  /** The days that the release gives as claims of a relation. */
  readonly days: ReturnType<typeof claimedDays>;
  readonly duplicates: ReadonlyMap<string, string>;
  readonly type: ReadonlyMap<string, string>;
  readonly designated: ReadonlySet<string>;
  readonly reader: RecordReader | null;
  /** The live read of excerpt_at_source, in release mode. */
  readonly source: SourceReader | null;
}

export const contextOf = (
  files: ReleaseFiles,
  reader: RecordReader | null,
  mode: 'release' | 'record' = reader === null ? 'release' : 'record',
  source: SourceReader | null = null,
): Context => {
  const claims = claimsOf(files.claims);
  const claimsOfEntity = new Map<string, Claim[]>();
  const actAttributes = new Map<string, Set<string>>();
  const designated = new Set<string>();
  const days = claimedDays(files.claims);
  // A day claim of a relation is a fact of both ends of the relation, as the relation is.
  const endsOf = new Map(
    files.relations.map((one) => [one['id'] ?? '', [one['from_id'] ?? '', one['to_id'] ?? '']]),
  );
  for (const claim of claims.values()) {
    const ends =
      claim.kind === 'relation'
        ? [claim.subject, claim.object]
        : days.has(claim.id)
          ? (endsOf.get(claim.subject) ?? [claim.subject])
          : [claim.subject];
    for (const one of new Set(ends))
      claimsOfEntity.set(one, [...(claimsOfEntity.get(one) ?? []), claim]);
    if (claim.kind === 'attribute')
      actAttributes.set(
        claim.subject,
        (actAttributes.get(claim.subject) ?? new Set()).add(claim.attribute),
      );
    if (claim.relationType === 'designated_by') designated.add(claim.subject);
  }
  const identifiers = identifiersOf(claims.values());
  return {
    mode,
    claims,
    claimsOfEntity,
    identifiers,
    farEnds: farEndsOf(files.entities, claims.values()),
    actAttributes,
    days,
    duplicates: duplicatesOf(files.entities, identifiers),
    type: new Map(files.entities.map((one) => [one['id'] ?? '', one['type'] ?? ''])),
    designated,
    reader,
    source,
  };
};

export interface FactLine {
  readonly claim: string;
  readonly kind: string;
  readonly origin: string;
  readonly letters: readonly string[];
  readonly storedValueInExcerpt: readonly string[];
  readonly results: readonly Result[];
}

export interface NodeLine {
  readonly kind: 'node';
  readonly node: string;
  readonly group: Group;
  readonly members: readonly string[];
  readonly verdict: ReturnType<typeof nodeVerdict>;
  readonly nodeResults: readonly Result[];
  readonly facts: readonly FactLine[];
}

/** The facts of a node: each claim about one of its members, once. */
export const factsOf = (node: AuditNode, context: Context): Claim[] => {
  const seen = new Map<string, Claim>();
  for (const one of node.members)
    for (const claim of context.claimsOfEntity.get(one) ?? []) seen.set(claim.id, claim);
  return [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

/** The nodes with a fact that cites one of these documents. */
export const citingNodes = (
  nodes: readonly AuditNode[],
  context: Context,
  documents: ReadonlySet<string>,
): AuditNode[] =>
  nodes.filter((node) =>
    factsOf(node, context).some((claim) =>
      claim.citations.some((row) => documents.has(row['document_id'] ?? '')),
    ),
  );

/** Runs each fixed check on one node. */
export const auditNode = async (node: AuditNode, context: Context): Promise<NodeLine> => {
  const facts: FactLine[] = [];
  for (const claim of factsOf(node, context)) {
    const results = [
      excerptPresent(claim),
      valueInExcerpt(claim, context.identifiers, context.farEnds),
      denyList(claim),
      identifierValid(claim),
      dates(claim, context.actAttributes, context.days),
      designationSource(claim, context.identifiers),
      await excerptAtSource(claim, context.mode, context.source),
      ...(await recordChecks(claim, context.reader)),
    ];
    facts.push({
      claim: claim.id,
      kind: claim.kind === 'relation' ? claim.relationType : claim.attribute,
      origin: originKind(claim.citations[0]?.['origin_label'] ?? ''),
      letters: [...new Set(claim.citations.map((row) => row['nato_letter'] ?? ''))],
      storedValueInExcerpt: [
        ...new Set(claim.citations.map((row) => row['value_in_excerpt'] ?? '')),
      ],
      results,
    });
  }
  const nodeResults = nodeChecks(
    node.members,
    facts.length,
    context.duplicates,
    context.type,
    context.designated,
  );
  const all = [...nodeResults, ...facts.flatMap((one) => one.results)];
  return {
    kind: 'node',
    node: node.id,
    group: node.group,
    members: node.members,
    verdict: nodeVerdict(all, context.mode),
    nodeResults,
    facts,
  };
};

interface Header {
  readonly kind: 'header';
  readonly version: number;
  readonly mode: 'release' | 'record';
  /** Record mode through the tunnel to the VPS: the export documents only, and no store. */
  readonly tunnel?: true;
  readonly release: { readonly tag: string; readonly sha256: string };
  readonly checks: readonly string[];
}

type Line = Header | NodeLine | ModelLine | { kind: 'start'; [key: string]: unknown };

const readLines = (file: string): Line[] =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter((one) => one.trim() !== '')
        .map((one) => JSON.parse(one) as Line)
    : [];

/** Removes a last line that a stopped run left cut, so the next line starts on its own line. A bad
 * line before the last one is a fault of the file, and the next read stops on it. */
export const repairTail = (file: string): void => {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const last = lines.at(-1) ?? '';
  if (last === '') return;
  try {
    JSON.parse(last);
    writeFileSync(file, `${text}\n`);
  } catch {
    writeFileSync(
      file,
      lines
        .slice(0, -1)
        .map((one) => `${one}\n`)
        .join(''),
    );
  }
};

const sameHeader = (a: Header, b: Header) =>
  a.version === b.version &&
  a.mode === b.mode &&
  a.tunnel === b.tunnel &&
  a.release.sha256 === b.release.sha256 &&
  a.checks.join() === b.checks.join();

// ---- The model check: behind --model, with a token cap, and no spend without --go. ----

export interface ModelLine {
  readonly kind: 'model';
  readonly node: string;
  readonly facts: readonly { claim: string; verdict: string; reason: string }[];
  readonly tokens: number;
}

const PROMPT_FILE = join(ROOT, 'packages/mcp/src/check-prompt.md');
// The same estimate as the second check of the research server: three bytes of text for one token.
const BYTES_PER_TOKEN = 3;

/** The user message of the checker for the facts of one node, in the shape of the second check. */
export const modelMessages = (prompt: string, claims: readonly Claim[]): Message[] => [
  { role: 'system', content: prompt },
  {
    role: 'user',
    content: JSON.stringify({
      claims: claims.map((claim) => {
        const row = claim.citations[0] ?? {};
        return {
          ref: claim.id,
          act:
            claim.kind === 'relation'
              ? {
                  type: 'create_relation',
                  source: row['subject_label'] ?? '',
                  relation: claim.relationType,
                  target: claim.objectLabel,
                  valid_from: (row['valid_from'] ?? '') === '' ? null : row['valid_from'],
                  valid_to: (row['valid_to'] ?? '') === '' ? null : row['valid_to'],
                }
              : {
                  type: 'set_attribute',
                  entity: row['subject_label'] ?? '',
                  key: claim.attribute,
                  value: claim.value,
                },
          originator: row['document_title'] ?? '',
          modality: row['modality'] ?? '',
          passages: claim.citations.map((one) => ({
            document: one['document_id'] ?? '',
            page: Number(one['page'] ?? '1'),
            excerpt: one['excerpt'] ?? '',
            context: one['excerpt'] ?? '',
          })),
        };
      }),
    }),
  },
];

export const tokensOf = (messages: readonly Message[], answerTokens: number): number =>
  Math.ceil(Buffer.byteLength(JSON.stringify(messages), 'utf8') / BYTES_PER_TOKEN) + answerTokens;

// The public price list of OpenRouter, in US dollars for one token. No key is sent.
const priceOf = async (model: string): Promise<{ prompt: number; completion: number } | null> => {
  try {
    const answer = await fetch('https://openrouter.ai/api/v1/models');
    const list = (await answer.json()) as {
      data?: { id: string; pricing?: { prompt?: string; completion?: string } }[];
    };
    const found = list.data?.find((one) => one.id === model);
    if (found?.pricing?.prompt === undefined || found.pricing.completion === undefined) return null;
    return { prompt: Number(found.pricing.prompt), completion: Number(found.pricing.completion) };
  } catch {
    return null;
  }
};

const runModel = async (
  nodes: readonly AuditNode[],
  context: Context,
  file: string,
  options: { tokenCap: number; go: boolean; checker: ModelConfig; limit?: number | undefined },
): Promise<void> => {
  const prompt = readFileSync(PROMPT_FILE, 'utf8');
  const done = new Set(
    readLines(file)
      .filter((one): one is ModelLine => one.kind === 'model')
      .map((one) => one.node),
  );
  const todo = nodes
    .filter((one) => !done.has(one.id))
    .map((node) => ({ node, claims: factsOf(node, context) }))
    .filter((one) => one.claims.length > 0)
    .slice(0, options.limit);
  const answer = options.checker.line.maxAnswerTokens;
  const needs = todo.map((one) => tokensOf(modelMessages(prompt, one.claims), answer));
  const total = needs.reduce((sum, one) => sum + one, 0);
  const price = await priceOf(options.checker.model);
  const cost =
    price === null
      ? 'unknown (no price from OpenRouter)'
      : `about ${needs.reduce((sum, one) => sum + (one - answer) * price.prompt + answer * price.completion, 0).toFixed(2)} USD (upper bound: each answer at the maximum)`;
  console.log(
    `Model check: ${String(todo.length)} nodes, about ${String(total)} tokens, ${cost}, model ${options.checker.model}, cap ${String(options.tokenCap)} tokens.`,
  );
  if (!options.go) {
    console.log('No call was sent. Add --go to spend this credit.');
    return;
  }
  const budget = openBudget(options.tokenCap);
  const model = openModel(openrouterModel(options.checker.model, env), options.checker.line, {
    // The call goes to the result file, not to the record: the audit is read only.
    record: async (call) => {
      appendFileSync(file, `${JSON.stringify({ kind: 'call', ...call })}\n`);
      return Promise.resolve(call.promptSha256);
    },
  });
  for (const [at, { node, claims }] of todo.entries()) {
    const need = needs[at] ?? 0;
    if (need > budget.left()) {
      console.log(`The token cap is reached before node ${node.id}. Run again with a higher cap.`);
      return;
    }
    const before = budget.spent();
    const asked = await model.ask({
      messages: modelMessages(prompt, claims),
      shape: checkAnswer,
      budget,
      oneCall: true,
    });
    const verdicts =
      asked.ok && 'value' in asked
        ? new Map(
            verdictsOf(
              claims.map((one) => one.id),
              asked.value,
            ),
          )
        : new Map<string, CheckVerdict>();
    const line: ModelLine = {
      kind: 'model',
      node: node.id,
      tokens: budget.spent() - before,
      facts: claims.map((claim) => {
        const said = verdicts.get(claim.id);
        if (said === undefined)
          return {
            claim: claim.id,
            verdict: 'cannot_check',
            reason: asked.ok ? 'no verdict' : `model failed: ${asked.failure.reason}`,
          };
        return {
          claim: claim.id,
          verdict:
            said.verdict === 'supported'
              ? 'pass'
              : said.verdict === 'not_supported'
                ? 'fail'
                : 'cannot_check',
          reason: 'reason' in said ? said.reason : 'supported',
        };
      }),
    };
    // A failed call leaves the node to do, so the next run asks again.
    if (!asked.ok) {
      console.log(`The model failed on node ${node.id}: ${asked.failure.reason}.`);
      continue;
    }
    appendFileSync(file, `${JSON.stringify(line)}\n`);
  }
};

// ---- The summary, built from the result file only. ----

/** The summary of a result file: counts by verdict, fail rate by check, failed nodes. */
export const summaryOf = (lines: readonly Line[], totalNodes: number): string => {
  const nodes = lines.filter((one): one is NodeLine => one.kind === 'node');
  const header = lines.find((one): one is Header => one.kind === 'header');
  const byVerdict = new Map<string, number>();
  for (const one of nodes) byVerdict.set(one.verdict, (byVerdict.get(one.verdict) ?? 0) + 1);
  // A claim of two nodes counts once for each check.
  const perCheck = new Map<string, Map<string, number>>();
  const reasons = new Map<string, number>();
  const seen = new Set<string>();
  const flagged = new Set<string>();
  const differ = { storedYesRecomputedFail: 0, storedNoRecomputedPass: 0 };
  const origins = new Map<string, number>();
  let unrated = 0;
  for (const node of nodes)
    for (const fact of node.facts) {
      if (seen.has(fact.claim)) continue;
      seen.add(fact.claim);
      origins.set(fact.origin, (origins.get(fact.origin) ?? 0) + 1);
      if (fact.kind === 'designated_by' && fact.letters.some((one) => one === 'C' || one === 'F'))
        flagged.add(fact.claim);
      for (const result of fact.results) {
        const own = perCheck.get(result.check) ?? new Map<string, number>();
        own.set(result.verdict, (own.get(result.verdict) ?? 0) + 1);
        perCheck.set(result.check, own);
        if (result.check === 'document_level' && result.reason === 'unrated') unrated += 1;
        if (result.verdict === 'fail' || result.verdict === 'cannot_check') {
          const key = `${result.check} ${result.verdict} ${result.reason.split(':')[0] ?? ''}`;
          reasons.set(key, (reasons.get(key) ?? 0) + 1);
        }
        if (result.check === 'value_in_excerpt') {
          const stored = fact.storedValueInExcerpt;
          if (result.verdict === 'fail' && stored.includes('yes'))
            differ.storedYesRecomputedFail += 1;
          if (result.verdict === 'pass' && !stored.includes('yes') && stored.includes('no'))
            differ.storedNoRecomputedPass += 1;
        }
      }
    }
  for (const node of nodes)
    for (const result of node.nodeResults) {
      const own = perCheck.get(result.check) ?? new Map<string, number>();
      own.set(result.verdict, (own.get(result.verdict) ?? 0) + 1);
      perCheck.set(result.check, own);
    }
  const model = lines.filter((one): one is ModelLine => one.kind === 'model');
  const modelCounts = new Map<string, number>();
  for (const one of model)
    for (const fact of one.facts)
      modelCounts.set(fact.verdict, (modelCounts.get(fact.verdict) ?? 0) + 1);
  const failed = nodes.filter((one) => one.verdict === 'fail');
  const mode = header?.mode ?? 'release';
  const out = [
    `# Node audit: ${header?.release.tag ?? ''}, ${mode} mode`,
    '',
    `Nodes audited: ${String(nodes.length)} of ${String(totalNodes)}.` +
      (nodes.length < totalNodes ? ' The run is not complete.' : ''),
    `Claims audited: ${String(seen.size)}.`,
    mode === 'release'
      ? 'Release mode reads the public release and the public address of each cited document. A "release_pass" is not a check of the stored document: document_exists, hash, excerpt_at_page and document_level need record mode. Each document that the run could not read is in local-check.txt, for record mode on the PC.'
      : header?.tunnel === true
        ? 'Record mode read the export documents through the tunnel, and no store: the hash is cannot_check(needs_store).'
        : 'Record mode read the database and the raw store.',
    '',
    '## Nodes by verdict',
    '',
    '| Verdict | Nodes |',
    '|---|---|',
    ...[...byVerdict].sort().map(([verdict, n]) => `| ${verdict} | ${String(n)} |`),
    '',
    '## Checks (each claim once)',
    '',
    '| Check | pass | fail | cannot_check | not_applicable | Fail rate of the checked |',
    '|---|---|---|---|---|---|',
    ...[...FACT_CHECKS, ...NODE_CHECKS].map((check) => {
      const own = perCheck.get(check) ?? new Map<string, number>();
      const n = (verdict: string) => own.get(verdict) ?? 0;
      const ran = n('pass') + n('fail');
      const rate = ran === 0 ? '-' : `${((100 * n('fail')) / ran).toFixed(1)}%`;
      return `| ${check} | ${String(n('pass'))} | ${String(n('fail'))} | ${String(n('cannot_check'))} | ${String(n('not_applicable'))} | ${rate} |`;
    }),
    '',
    `Claims whose cited documents are all unrated (document_level pass "unrated", ADR 0039): ${String(unrated)}.`,
    '',
    '## Reasons of fail and cannot_check',
    '',
    '| Check, verdict, reason | Claims |',
    '|---|---|',
    ...[...reasons].sort((a, b) => b[1] - a[1]).map(([key, n]) => `| ${key} | ${String(n)} |`),
    '',
    '## Stored value_in_excerpt against the recomputed check',
    '',
    `Stored "yes", recomputed fail: ${String(differ.storedYesRecomputedFail)}. Stored "no", recomputed pass: ${String(differ.storedNoRecomputedPass)}.`,
    '',
    '## Who decided the claims',
    '',
    ...[...origins].sort().map(([kind, n]) => `- ${kind}: ${String(n)}`),
    '',
    `## Flagged: designations with a citation of NATO letter C or F (${String(flagged.size)})`,
    '',
    'The letter rates the author (docs/decisions.md S1), so these claims do not fail. Read each one.',
    '',
    ...[...flagged].sort().map((one) => `- ${one}`),
    '',
    '## Model check',
    '',
    model.length === 0
      ? 'Not run.'
      : `${String(model.length)} nodes. ` +
        [...modelCounts]
          .sort()
          .map(([verdict, n]) => `${verdict} ${String(n)}`)
          .join(', ') +
        `. Tokens: ${String(model.reduce((sum, one) => sum + one.tokens, 0))}. A model verdict never makes a failed fixed check pass.`,
    '',
    `## Failed nodes (${String(failed.length)})`,
    '',
    '| Node | Group | Failed checks |',
    '|---|---|---|',
    ...failed.map((one) => {
      const checks = new Set(
        [...one.nodeResults, ...one.facts.flatMap((fact) => fact.results)]
          .filter((result) => result.verdict === 'fail')
          .map((result) => result.check),
      );
      return `| ${one.node} | ${one.group} | ${[...checks].join(', ')} |`;
    }),
    '',
  ];
  return out.join('\n');
};

/** The ids of the claims with a failed check, one for each line, for the skill review-unit. */
export const failedClaimsOf = (lines: readonly Line[]): string[] => {
  const failed = new Set<string>();
  for (const one of lines) {
    if (one.kind === 'node')
      for (const fact of one.facts)
        if (fact.results.some((result) => result.verdict === 'fail')) failed.add(fact.claim);
    if (one.kind === 'model')
      for (const fact of one.facts) if (fact.verdict === 'fail') failed.add(fact.claim);
  }
  return [...failed].sort();
};

// ---- Record mode: the database and the raw store of the PC, read only. ----

const openRecordReader = async (): Promise<{
  reader: RecordReader;
  close: () => Promise<void>;
}> => {
  const { default: pg } = await import('pg');
  const { connectionString } = await import('./db-runtime.ts');
  const { openReadStore, readObject } = await import('@gab/store');
  // Each session of the pool starts read only, so a write fails at the database.
  const pool = new pg.Pool({
    connectionString: connectionString('app'),
    max: 2,
    options: '-c default_transaction_read_only=on',
  });
  const store = openReadStore();
  const documents = new Map<string, Awaited<ReturnType<RecordReader['document']>>>();
  const reader: RecordReader = {
    document: async (id) => {
      if (documents.has(id)) return documents.get(id) ?? null;
      const { rows } = await pool.query<{
        sha256: string | null;
        s3_key: string | null;
        level: string;
      }>(
        'SELECT sha256, s3_key, public.document_level(id::text) AS level FROM public.documents WHERE id = $1::text',
        [id],
      );
      const row = rows[0];
      let found: Awaited<ReturnType<RecordReader['document']>> = null;
      if (row !== undefined) {
        let stored = '';
        try {
          if (row.s3_key !== null) stored = sha256Of(await readObject(store, row.s3_key));
        } catch {
          stored = 'not in the store';
        }
        found = { sha256: row.sha256 ?? '', level: row.level, storedSha256: stored };
      }
      documents.set(id, found);
      return found;
    },
    page: async (id, page) => {
      const { rows } = await pool.query<{ text: string }>(
        `SELECT text FROM public.document_text
          WHERE document_id = $1::text AND page = $2::int
            AND extractor = public.newest_text_extractor($1::text)`,
        [id, page],
      );
      return rows[0]?.text ?? null;
    },
  };
  return { reader, close: () => pool.end() };
};

/** The reader of the VPS: the record through the tunnel that the PC opens, as gabriel_audit, through
 * the two views of the schema audit. The tunnel carries no store, so the hash is cannot_check. */
const openTunnelReader = async (
  file: string,
): Promise<{ reader: RecordReader; close: () => Promise<void> }> => {
  // The file holds a password: refuse it when another user can read it.
  if (platform !== 'win32' && (statSync(file).mode & 0o077) !== 0)
    throw new Error(`${file} can be read by another user. Run chmod 600 on it.`);
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: tunnelConnection(readFileSync(file, 'utf8')),
    max: 1,
    options: '-c default_transaction_read_only=on',
  });
  const reader: RecordReader = {
    document: async (id) => {
      const { rows } = await pool.query<{
        exportable: boolean;
        sha256: string | null;
        level: string | null;
      }>('SELECT exportable, sha256, level FROM audit.document WHERE id = $1::text', [id]);
      const row = rows[0];
      if (row?.exportable === false) return 'hidden';
      return row === undefined
        ? null
        : { sha256: row.sha256 ?? '', level: row.level ?? '', storedSha256: null };
    },
    page: async (id, page) => {
      const { rows } = await pool.query<{ text: string }>(
        'SELECT text FROM audit.document_text WHERE document_id = $1::text AND page = $2::int',
        [id, page],
      );
      return rows[0]?.text ?? null;
    },
  };
  return { reader, close: () => pool.end() };
};

// ---- The command. ----

const main = async () => {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      out: { type: 'string' },
      limit: { type: 'string' },
      'only-report-nodes': { type: 'boolean', default: false },
      record: { type: 'boolean', default: false },
      tunnel: { type: 'string' },
      'local-check': { type: 'string' },
      model: { type: 'boolean', default: false },
      'token-cap': { type: 'string' },
      go: { type: 'boolean', default: false },
      release: { type: 'string' },
    },
  });
  const mode = values.record ? 'record' : 'release';
  if (values.tunnel !== undefined && !values.record) {
    console.error('--tunnel needs --record.');
    exit(1);
  }
  if (values['local-check'] !== undefined && !values.record) {
    console.error('--local-check needs --record.');
    exit(1);
  }
  if (values.limit !== undefined && !/^[1-9]\d*$/u.test(values.limit)) {
    console.error('--limit takes a whole number above zero.');
    exit(1);
  }
  const folder = values.release ?? (await reportRelease());
  const files = readRelease(folder);
  // A run through the tunnel has no hash check, so its results never share a folder with the PC.
  const suffix = values.tunnel === undefined ? mode : 'tunnel';
  const out = resolve(
    values.out ?? join(ROOT, 'node-audit-out', `${REPORT_RELEASE.tag}-${suffix}`),
  );
  mkdirSync(out, { recursive: true });
  const file = join(out, 'results.jsonl');

  const reportText = readFileSync(REPORT_NODES, 'utf8');
  const reportEntities = reportEntityIds(reportText);
  const { nodes: ordered, missingReportEntities } = auditOrder(files, reportEntities);
  const reportOnly = values['only-report-nodes']
    ? ordered.filter((one) => one.group === 'report')
    : ordered;

  const header: Header = {
    kind: 'header',
    version: AUDIT_VERSION,
    mode,
    ...(values.tunnel === undefined ? {} : { tunnel: true as const }),
    // Another release is named by its folder name and the hash of its manifest, never by a path.
    release:
      values.release === undefined
        ? REPORT_RELEASE
        : {
            tag: basename(resolve(folder)),
            sha256: sha256Of(readFileSync(join(folder, 'manifest.json'))),
          },
    checks: [...FACT_CHECKS, ...NODE_CHECKS],
  };
  repairTail(file);
  const lines = readLines(file);
  const held = lines.find((one): one is Header => one.kind === 'header');
  if (held !== undefined && !sameHeader(held, header)) {
    console.error(`${file} holds a run of other checks or another release. Give a new --out.`);
    exit(1);
  }
  if (held === undefined) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    const counted = count(replay(files));
    writeFileSync(file, `${JSON.stringify(header)}\n`);
    appendFileSync(
      file,
      `${JSON.stringify({
        kind: 'start',
        commit,
        claimRows: files.claims.length,
        claims: new Set(files.claims.map((one) => one['claim_id'])).size,
        nodes: ordered.length,
        critical: counted.critical,
        reportNodes: ordered.filter((one) => one.group === 'report').length,
        missingReportEntities,
        reportCountryGaps: reportCountryGaps(reportText, files.claims),
      })}\n`,
    );
  }

  const reader =
    !values.record || values.model
      ? null
      : values.tunnel === undefined
        ? await openRecordReader()
        : await openTunnelReader(values.tunnel);
  const source =
    mode === 'release' && !values.model
      ? sourceReader(out, { now: () => new Date(), hostLease: hostGuards(env).hostLease })
      : null;
  const context = contextOf(files, reader?.reader ?? null, mode, source);
  // A record run on the PC for the documents that the VPS could not read: only the nodes that cite one.
  const wanted =
    values['local-check'] === undefined
      ? null
      : localCheckIds(readFileSync(values['local-check'], 'utf8'));
  const scope = wanted === null ? reportOnly : citingNodes(reportOnly, context, wanted);
  try {
    if (values.model) {
      const cap = Number(values['token-cap']);
      if (!Number.isInteger(cap) || cap <= 0) {
        console.error('--model needs --token-cap <a whole number of tokens>.');
        exit(1);
      }
      await runModel(scope, context, file, {
        limit: values.limit === undefined ? undefined : Number(values.limit),
        tokenCap: cap,
        go: values.go,
        checker: readModelConfig('CHECKER', env),
      });
    } else {
      const done = new Set(
        readLines(file)
          .filter((one): one is NodeLine => one.kind === 'node')
          .map((one) => one.node),
      );
      const todo = scope.filter((one) => !done.has(one.id));
      const limit = values.limit === undefined ? todo.length : Number(values.limit);
      const started = Date.now();
      for (const node of todo.slice(0, limit)) {
        appendFileSync(file, `${JSON.stringify(await auditNode(node, context))}\n`);
      }
      console.log(
        `Audited ${String(Math.min(limit, todo.length))} nodes in ${String(Math.round((Date.now() - started) / 1000))} s.`,
      );
    }
  } finally {
    await reader?.close();
  }
  const final = readLines(file);
  writeFileSync(join(out, 'summary.md'), summaryOf(final, scope.length));
  writeFileSync(join(out, 'failed-claims.txt'), `${failedClaimsOf(final).join('\n')}\n`);
  if (source !== null) {
    const local = localCheckLines(out);
    writeFileSync(join(out, LOCAL_CHECK), local.map((line) => `${line}\n`).join(''));
    console.log(
      `Documents to check on the PC: ${String(local.length)} in ${join(out, LOCAL_CHECK)}`,
    );
  }
  console.log(`Results: ${file}\nSummary: ${join(out, 'summary.md')}`);
};

if (argv[1] === fileURLToPath(import.meta.url)) await main();
