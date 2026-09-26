export const meta = {
  name: 'gab-deep-review',
  description:
    'Pre-launch deep review of GAB: 8 code layers x 5 dimensions, every finding checked twice, simplification proposals included',
  whenToUse:
    'Run once, before the first real use of the app and before AI agents write into the data at volume. Pass args to scope a smaller run: { layers: ["contracts"], dimensions: ["correctness"], dryRun: true }. With no args, runs the full matrix and writes the real report files and GitHub comments.',
  phases: [
    { title: 'Review', detail: 'one agent per layer x dimension cell reads the code and proposes findings' },
    { title: 'Verify', detail: 'a second, independent agent re-derives each candidate finding from the code' },
    { title: 'Synthesize', detail: 'one agent per layer writes the report file and comments on its tracker issue' },
  ],
}

// Each entry names one part of the code, its GitHub tracker issue (created ahead of this run),
// and the report file this run writes.
const LAYERS = [
  {
    key: 'db',
    title: 'Database',
    paths: ['db/apply', 'db/migrations', 'packages/store'],
    issue: 160,
    outFile: 'docs/review/01-database.md',
  },
  {
    key: 'contracts',
    title: 'Contracts',
    paths: ['packages/model', 'packages/proposal'],
    issue: 161,
    outFile: 'docs/review/02-contracts.md',
  },
  {
    key: 'writer',
    title: 'Writer service',
    paths: ['packages/writer'],
    issue: 162,
    outFile: 'docs/review/03-writer.md',
  },
  {
    key: 'worker',
    title: 'Worker service',
    paths: ['packages/worker'],
    issue: 163,
    outFile: 'docs/review/04-worker.md',
  },
  {
    key: 'detail',
    title: 'Frontend: detail',
    paths: ['src/features/detail'],
    issue: 164,
    outFile: 'docs/review/05-frontend-detail.md',
  },
  {
    key: 'review-routes-shared',
    title: 'Frontend: review, routes, shared',
    paths: ['src/features/review', 'src/routes', 'src/shared'],
    issue: 165,
    outFile: 'docs/review/06-frontend-review-routes-shared.md',
  },
  {
    key: 'tests-tooling',
    title: 'Tests and tooling',
    paths: ['tools', 'eslint.config.ts', 'vitest.config.ts', 'tsconfig.json'],
    issue: 166,
    outFile: 'docs/review/07-tests-tooling.md',
  },
  {
    key: 'cross-cutting',
    title: 'Cross-cutting: security and ADR conformance',
    paths: ['docs/adr', 'docs/decisions.md', 'README.md', 'packages/writer', 'packages/worker'],
    issue: 167,
    outFile: 'docs/review/08-cross-cutting.md',
  },
]

const DIMENSIONS = [
  {
    key: 'correctness',
    title: 'Correctness and edge cases',
    instruction:
      'Look for real logic bugs: wrong conditionals, off-by-one errors, race conditions, incorrect null/undefined handling, wrong error propagation, incorrect assumptions about input shape. Ignore style.',
  },
  {
    key: 'security',
    title: 'Security',
    instruction:
      'Look for real security defects: missing input validation at a trust boundary, injection risk, secrets or credentials handled unsafely, a missing authorization or admission check, unsafe deserialization, anything that lets an attacker or a buggy AI agent write data it should not be able to write.',
  },
  {
    key: 'coverage',
    title: 'Test coverage and quality',
    instruction:
      'Look for a missing test for a real code path (not for a trivial getter), a weak assertion that would pass even if the implementation were wrong, and a test that is skipped, disabled, or silently a no-op.',
  },
  {
    key: 'adr',
    title: 'Architecture and ADR conformance',
    instruction:
      'Compare the code against docs/adr/*.md and docs/decisions.md. Report a place where the code disagrees with a decision or an ADR, or where a comment in src/ carries a reference (a path, a "§", a ticket number) instead of a reason, which ADR 0006 itself forbids.',
  },
  {
    key: 'simplify',
    title: 'Simplification and structural discipline',
    instruction: null, // built by simplifyInstruction(layer) below, since it is layer-specific
  },
]

const SIMPLIFY_BASE = `
Look for two kinds of thing here, and return each as its own finding:

1. A plain simplification: dead code, duplicate logic that belongs in one function, an
   abstraction with one caller, a configuration knob nobody reads, a table or a layer that
   nothing reads, a mode or a flag nobody requested. Nothing is deployed yet and no production
   data exists yet, so you may propose a breaking change. Mark it kind: "simplification".

2. A data-integrity gap: a place where the code lets an attribute, a claim, or a source be
   written in a way that is inconsistent with another attribute of the same kind, or unsourced,
   or silently overwritten, or where a promised distinction (candidate vs evidentiary, machine
   vs human, current vs corrected) is only claimed by a comment or a document and not actually
   enforced by the code. Mark it kind: "issue", and set severity by how much silent, undetectable
   wrong public data it could produce.

Before proposing a change that touches the data model or a write path, read docs/decisions.md.
An identifier such as M7, M8, M9, M11, S1, S2, P1, P4, T3, or T6 names a locked decision. You may
still propose reopening one — there is no migration cost yet — but you must name the identifier
and argue the case in "decision_conflict"; do not silently contradict it.
`

const LAYER_SIMPLIFY_FOCUS = {
  db: `
Specific to this layer: does an attribute-key allow-list exist — a table or an enum that names
the valid keys per entity type? Is it enforced by a trigger or a constraint that fires on every
INSERT or UPDATE, or only by a periodic monitoring view that depends on a human reading it? Are
CHECK constraints present for the M7 {value, sources} shape and the M8 "at least one source"
rule, or is either rule only assumed by the application layer? Is the raw-document store's
immutability enforced by any mechanism (versioning, object lock, a content-hash key), or only
assumed by convention, per T3? Report on whether any append-only trail of who wrote what and when
exists — report this as a finding either way, with no fix proposed, since reversing M5 or C5 is an
operator-level decision, not something this review decides.`,
  contracts: `
Specific to this layer: does the Zod schema in packages/model and packages/proposal enforce the
same rules the database is supposed to enforce, per T6's two-tier rule, including any
attribute-key check? Does the proposal payload shape match P4's frozen contract exactly (target,
operation, value, mandatory sources, confidence score, emitting agent, dissenting votes), with no
field that lets a source be silently optional?`,
  writer: `
Specific to this layer: can any path in admission, decide, sign, or routes promote a write into
the graph without a source, or without going through the candidate-to-evidentiary gate? Is the
reserved "operator authority" source of M8 reachable by a machine-originated write? Trace one full
promotion path end to end and say what you found.`,
  worker: `
Specific to this layer: can a retried job (see T9 and T9a's retry counts) or two racing workers
write conflicting values for the same attribute without either failing or being flagged? Is job
claiming actually exclusive under a race?`,
  detail: `
Specific to this layer: does every attribute shown in the UI display its source, never a bare
value? Is the candidate-vs-evidentiary visual distinction that PU1 claims as a mitigation actually
non-bypassable in this code, or is there a state where a candidate renders without its label? Does
the rename or merge UI preserve M12's reversibility — a full snapshot of the absorbed entity?`,
  'review-routes-shared': `
Specific to this layer: the same candidate-vs-evidentiary labelling question, for the review queue
and the map or graph routes. Does the read model under src/shared/read ever merge or flatten a
value in a way that loses which source backs it?`,
  'tests-tooling': `
Specific to this layer: does the test suite contain a test that inserting a near-duplicate
attribute key (for example coalStock next to an existing coal_stock_t) is rejected? Does it
contain a test that a proposal missing a source is rejected at both the Zod boundary and the
database? If either test is missing, that is itself a confirmed finding of this dimension, not
merely a suggestion.`,
  'cross-cutting': `
Specific to this layer: read the current public-facing text (README.md, any UI copy under src/
that describes scoring) and compare it against docs/decisions.md entry S1. S1 states that
ADMIRALTY scoring is per document, never per claim. Report a confirmed finding if any
public-facing text claims or implies claim-level scoring. Also answer, from the maintainer's own
side and with no hostile role-play: what is the single missing control that would most damage
trust in the whole published dataset if a hostile reader found it first, and what closes it.
Return this last one as a finding of kind "issue".`,
}

function simplifyInstruction(layer) {
  return SIMPLIFY_BASE + '\n' + (LAYER_SIMPLIFY_FOCUS[layer.key] || '')
}

function dimensionInstruction(layer, dim) {
  return dim.key === 'simplify' ? simplifyInstruction(layer) : dim.instruction
}

function reviewPrompt(layer, dim) {
  return `You are reviewing the GAB codebase — an open-source OSINT data-fusion tool that maps
sanctions-evasion infrastructure; its output is published under CC-BY and cited by journalists —
for one dimension of a pre-launch review.

Layer: ${layer.title}. Files: ${layer.paths.join(', ')}.
Dimension: ${dim.title}.

Read docs/decisions.md first for the project's locked architecture decisions. An identifier such
as M7, M8, M11, S1, S2, P1, T3, or T6 names a locked decision: disagreeing with one is not silent
permission to ignore it. Read the files under docs/adr/ too when this dimension is "Architecture
and ADR conformance".

${dimensionInstruction(layer, dim)}

Read every file under the listed paths, not a sample. For each real thing you find, return one
finding with:
- kind: "issue" or "simplification"
- file: the exact repo-relative path
- line: the line number, or null if the finding is structural or spans files
- severity: "blocker", "major", "minor", or "nit" for an issue; "proposal" for a simplification
- summary: one sentence
- detail: for an issue, the concrete input or state that triggers the wrong behavior, quoting the
  offending code; for a simplification, the current shape, the proposed simpler shape, and why it
  is safe
- decision_conflict: null, or the identifier of the docs/decisions.md or ADR entry a proposed
  change would need to reopen, with your argument for why that is justified

Report only what you actually read, at a named file and line. No generic advice with no location.
Return an empty findings array if you genuinely find nothing real — do not invent a finding to
have something to report.`
}

function verifyPrompt(layer, dim, finding) {
  return `Independently verify one candidate finding from a review of GAB (layer: ${layer.title},
dimension: ${dim.title}). Do not trust the description below — re-derive it yourself by reading
the named file.

kind: ${finding.kind}
file: ${finding.file}
line: ${finding.line}
severity: ${finding.severity}
summary: ${finding.summary}
detail: ${finding.detail}
${finding.decision_conflict ? 'claimed decision conflict: ' + finding.decision_conflict : 'claimed decision conflict: none'}

Read the named file yourself, and docs/decisions.md or the named ADR if a decision conflict is
claimed. Then decide:
- CONFIRMED: you can point to your own evidence, independent of the description above (quote the
  actual code, cite the line you read), that the defect — or, for a simplification, the
  opportunity — is real and safe to report.
- FALSE_ALARM: the code does not have this problem as described, or the proposed simplification
  would break something (name what), or you cannot locate it in the file as it stands.

Default to FALSE_ALARM when you are not sure. This review reports only confirmed, doubly-checked
findings, never suspicions.

Return your verdict, your own proof (quote the code and cite the line you checked, in your own
words, not a repeat of the description above), and, if a decision conflict was claimed, whether
reopening that locked entry is actually justified, in "decision_conflict_check".`
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'file', 'line', 'severity', 'summary', 'detail', 'decision_conflict'],
        properties: {
          kind: { type: 'string', enum: ['issue', 'simplification'] },
          file: { type: 'string' },
          line: { type: ['integer', 'null'] },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit', 'proposal'] },
          summary: { type: 'string' },
          detail: { type: 'string' },
          decision_conflict: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'proof', 'decision_conflict_check'],
  properties: {
    verdict: { type: 'string', enum: ['CONFIRMED', 'FALSE_ALARM'] },
    proof: { type: 'string' },
    decision_conflict_check: { type: ['string', 'null'] },
  },
}

const selectedLayers =
  args && Array.isArray(args.layers) ? LAYERS.filter((l) => args.layers.includes(l.key)) : LAYERS
const selectedDimensions =
  args && Array.isArray(args.dimensions)
    ? DIMENSIONS.filter((d) => args.dimensions.includes(d.key))
    : DIMENSIONS
const dryRun = Boolean(args && args.dryRun)

if (selectedLayers.length === 0 || selectedDimensions.length === 0) {
  return { error: 'no layer or no dimension matched the given args', results: [] }
}

const cells = []
for (const layer of selectedLayers) {
  for (const dim of selectedDimensions) {
    cells.push({ layer, dim })
  }
}

log(
  `Reviewing ${cells.length} cell(s) across ${selectedLayers.length} layer(s) and ` +
    `${selectedDimensions.length} dimension(s)${dryRun ? ' (dry run — no files written, no GitHub comments posted)' : ''}.`,
)

const cellResults = await pipeline(
  cells,

  (cell) =>
    agent(reviewPrompt(cell.layer, cell.dim), {
      label: `review: ${cell.layer.key} / ${cell.dim.key}`,
      phase: 'Review',
      schema: FINDINGS_SCHEMA,
      effort: 'high',
    }),

  async (reviewResult, cell) => {
    const candidates = reviewResult && Array.isArray(reviewResult.findings) ? reviewResult.findings : []
    if (candidates.length === 0) {
      return {
        layer: cell.layer.key,
        layerTitle: cell.layer.title,
        dim: cell.dim.key,
        dimTitle: cell.dim.title,
        confirmed: [],
        falseAlarms: [],
      }
    }

    const verdicts = await parallel(
      candidates.map((finding) => () =>
        agent(verifyPrompt(cell.layer, cell.dim, finding), {
          label: `verify: ${cell.layer.key} / ${cell.dim.key}`,
          phase: 'Verify',
          schema: VERDICT_SCHEMA,
          effort: 'high',
        }).then((verdict) => ({ finding, verdict })),
      ),
    )

    const confirmed = []
    const falseAlarms = []
    for (const item of verdicts.filter(Boolean)) {
      if (!item.verdict) continue
      if (item.verdict.verdict === 'CONFIRMED') {
        confirmed.push({
          kind: item.finding.kind,
          file: item.finding.file,
          line: item.finding.line,
          severity: item.finding.severity,
          summary: item.finding.summary,
          review_proof: item.finding.detail,
          verify_proof: item.verdict.proof,
          decision_conflict: item.finding.decision_conflict,
          decision_conflict_check: item.verdict.decision_conflict_check,
        })
      } else {
        falseAlarms.push({
          kind: item.finding.kind,
          file: item.finding.file,
          summary: item.finding.summary,
          rejection_reason: item.verdict.proof,
        })
      }
    }

    return {
      layer: cell.layer.key,
      layerTitle: cell.layer.title,
      dim: cell.dim.key,
      dimTitle: cell.dim.title,
      confirmed,
      falseAlarms,
    }
  },
)

// Group the (layer x dimension) cell results back up to one entry per layer, so one
// synthesis agent sees every dimension for its layer at once — a real cross-item dependency,
// not a gratuitous barrier: the report file and the issue comment are one-per-layer, not
// one-per-cell.
const byLayer = new Map()
for (const layer of selectedLayers) {
  byLayer.set(layer.key, { layer, cells: [] })
}
for (const result of cellResults.filter(Boolean)) {
  const entry = byLayer.get(result.layer)
  if (entry) entry.cells.push(result)
}

phase('Synthesize')
const layerReports = await parallel(
  Array.from(byLayer.values()).map((entry) => () => {
    const totalConfirmed = entry.cells.reduce((n, c) => n + c.confirmed.length, 0)
    const totalFalseAlarms = entry.cells.reduce((n, c) => n + c.falseAlarms.length, 0)

    const sections = entry.cells
      .map((cell) => {
        const issues = cell.confirmed.filter((f) => f.kind === 'issue')
        const simplifications = cell.confirmed.filter((f) => f.kind === 'simplification')
        const renderFinding = (f, i) =>
          `${i + 1}. **${f.summary}**\n   - file: \`${f.file}\`${f.line ? `:${f.line}` : ''}\n   - severity: ${f.severity}\n   - review agent's proof: ${f.review_proof}\n   - verify agent's proof: ${f.verify_proof}` +
          (f.decision_conflict
            ? `\n   - decision conflict claimed: ${f.decision_conflict}\n   - verify agent's check: ${f.decision_conflict_check || 'none given'}`
            : '')
        return `## ${cell.dimTitle}\n\n${
          issues.length === 0 && simplifications.length === 0
            ? 'No confirmed finding.'
            : [
                issues.length ? `### Issues\n\n${issues.map(renderFinding).join('\n\n')}` : '',
                simplifications.length
                  ? `### Simplification proposals\n\n${simplifications.map(renderFinding).join('\n\n')}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n\n')
        }`
      })
      .join('\n\n')

    const falseAlarmLog = entry.cells
      .flatMap((cell) => cell.falseAlarms.map((fa) => ({ dim: cell.dimTitle, ...fa })))
      .map((fa, i) => `${i + 1}. [${fa.dim}] ${fa.summary} (${fa.file}) — rejected: ${fa.rejection_reason}`)
      .join('\n')

    const reportBody = `# Deep review — ${entry.layer.title}

Part of #168. Tracker issue: #${entry.layer.issue}.

${totalConfirmed} confirmed finding(s) across ${entry.cells.length} dimension(s). ${totalFalseAlarms} candidate(s) rejected on independent verification (logged below, not counted as issues).

${sections}

## False alarms (rejected candidates, logged for audit only)

${falseAlarmLog || 'None.'}
`

    const commentBody = `Deep review ran for this layer.

${entry.cells
  .map((c) => `- ${c.dimTitle}: ${c.confirmed.filter((f) => f.kind === 'issue').length} issue(s), ${c.confirmed.filter((f) => f.kind === 'simplification').length} simplification proposal(s), ${c.falseAlarms.length} false alarm(s)`)
  .join('\n')}

Full findings, with proof from both the finder and the independent verifier: \`${entry.layer.outFile}\`.`

    if (dryRun) {
      return Promise.resolve({
        layer: entry.layer.key,
        outFile: entry.layer.outFile,
        issue: entry.layer.issue,
        reportBody,
        commentBody,
        wrote: false,
        commented: false,
      })
    }

    return agent(
      `Write the file "${entry.layer.outFile}" with the Write tool, with exactly this content
(create the docs/review directory first if it does not exist yet). docs/README.md must list the
file, or the docs protection hook refuses it; the hook can also ask the operator to confirm the
write. Do not write the file through Bash.

---BEGIN FILE CONTENT---
${reportBody}
---END FILE CONTENT---

If, and only if, the file write succeeded, run this exact command to post a summary comment on
the tracker issue for this layer. The comment points to the file, so it must not exist without it.

gh issue comment ${entry.layer.issue} --repo gabriel-neutron/GAB --body-file <a temp file you write with exactly this content>

---BEGIN COMMENT CONTENT---
${commentBody}
---END COMMENT CONTENT---

Do only these two things. Do not edit any other file, do not close or edit the issue itself, do
not add labels.

End your reply with exactly one line: "RESULT: file=<written|failed> comment=<posted|skipped|failed>".`,
      { label: `synthesize: ${entry.layer.key}`, phase: 'Synthesize' },
    ).then((text) => {
      // The agent reports what it did; a hook or a classifier can stop the write.
      // Only the last line counts, so a RESULT quoted earlier in the reply cannot match.
      const result = (text || '').trim().split('\n').pop()
      const wrote = /^RESULT: file=written\b/.test(result)
      return {
        layer: entry.layer.key,
        outFile: entry.layer.outFile,
        issue: entry.layer.issue,
        reportBody,
        commentBody,
        wrote,
        commented: wrote && /\bcomment=posted\b/.test(result),
        agentNote: text,
      }
    })
  }),
)

return {
  dryRun,
  cellsReviewed: cellResults.filter(Boolean).length,
  totalConfirmed: cellResults.filter(Boolean).reduce((n, c) => n + c.confirmed.length, 0),
  totalFalseAlarms: cellResults.filter(Boolean).reduce((n, c) => n + c.falseAlarms.length, 0),
  layerReports: layerReports.filter(Boolean),
}
