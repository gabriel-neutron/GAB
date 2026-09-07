export const meta = {
  name: 'ready-for-agent-run',
  description:
    'Run each ready-for-agent ticket one after the other: open it, solve it, review it for the simplest solution, and resolve it on the tracker',
  whenToUse:
    'The operator wants the ready-for-agent queue worked with nobody in the loop. Pass no args to take the queue in tracker order, or pass ticket numbers to name the run.',
  phases: [
    { title: 'Choose', detail: 'one agent reads the queue, drops each blocked ticket, and claims the run' },
    { title: 'Solve', detail: 'one agent does the work of one ticket: code for a task, a finding for a research' },
    { title: 'Review', detail: 'one agent reads the diff for quality and for the simplest solution' },
    { title: 'Repair', detail: 'one agent applies the review, once, and never twice' },
    { title: 'Resolve', detail: 'one agent comments, and closes the ticket where the work holds' },
    { title: 'Map', detail: 'one agent appends each pointer to the wayfinding map' },
  ],
}

// Four tickets per run. The operator chose it: four tickets cost about sixteen agents, and a run
// of all nine costs more than one report holds.
const MAX_TICKETS = 4

// The map issue of this repository. A child ticket carries `Part of #1` in its body.
const MAP_ISSUE = 1

// The tickets run one after the other, and never in parallel. Two solvers in one working tree
// write over each other, and the operator reads one diff at the end of the run.

const HOUSE = `
You work one ticket of the GAB project, on branch main, on Windows.

Read docs/README.md first. It routes each task to the document that governs it.
Read docs/spec.md for the invariants, the read path and the write path.
Read docs/decisions.md for a named entry such as M8, P1 or T5. That register is locked.
Read an ADR under docs/adr/ when the work touches the runtime, the schema, the frontend, the map
or a comment. Read the SQL under db/ for the authority on a constraint, never a document.

The facts of this project. One operator. Windows. Docker Desktop. A local stack of PostgreSQL with
PostGIS and pgvector, MinIO and PostgREST, on the loopback address alone. TypeScript on both sides.
No team. No on-call. No paying user. No deployment.

Four rules bind every step of this run.
1. Do not commit. The operator reads the diff. Never run git commit, git push or git checkout.
2. The operator owns docs/. A hook refuses a write there. A change to docs/ goes out as a question.
3. pnpm check is the conformance command. ADR 0001 3 names it. It never runs the tests. Run
   pnpm test only where the ticket asks for a test. No test policy exists; it is open ticket 21.
   Do not invent one.
4. Every write to GitHub acts as gabriel-neutron. Confirm with: gh api user --jq .login
   Never run gh auth login or gh auth switch. Never print or copy the token.
`

// The five cases are the ESCALATION block of .claude/workflows/requirement-debate.js. An
// autonomous run still asks the operator for what the five reserve.
const ESCALATION = `
The operator is asked only where a technical expert cannot decide. One of these five is true:
1. The answer changes what the product does, or what it refuses to do.
2. The answer is a judgement of risk, of law, of ethics, or of who is trusted.
3. The answer spends money, or it starts a subscription.
4. The answer is costly to reverse.
5. The experts split, and no fact in the repository breaks the tie.
Where none of the five is true, you decide. Do not send a question up because it feels large.
Take the reversible option, record it as an assumption with its cost and what proves it wrong,
and continue. A question takes four parts: the choice, the options, the one you recommend, and
what it costs if the recommendation is wrong.
`

// The review brief of the operator, in one word: minimal. It reads quality, and not correctness.
const SIMPLEST = `
You review for quality and for simplicity. You do not hunt for a correctness defect.
The rule of the operator: always take the simplest and the most minimal solution.
Your bias is to delete. You add no part, and you propose no new part.

Refuse each of these on sight:
- a part that answers a question the ticket did not ask
- an abstraction with one caller
- a configuration value that holds one value
- a mode, a flag or an option that nobody requested
- a retry, a cache, a pool or an index that nobody measured
- a table, a column, a file or a layer that nothing reads
- work for a deployment, a team or a scale that does not exist
- a second way to do a thing that one way already does
- a rule in code that repeats a rule the database already holds
- a comment that is not an external constraint, the origin of a number, or a departure

Test each part with one question: delete it, and what breaks?
Where nothing breaks, refuse it. Where you cannot name what breaks, refuse it.
An accepted diff is a real result. Do not invent a finding to look useful.
`

// The quality rules of .claude/agents/gab-coder.md, as the checklist of the review step.
const RULES = `
The rules the diff must hold, from .claude/agents/gab-coder.md:
- Seam: one main symbol from each file, and more than three exports is a fault.
- Seam: each export named in domain words that say what the caller gets.
- Deep: each detail of storage, transport, format and retry stays inside the module.
- Deep: each interior larger than its seam.
- Feature: one feature in one flat folder, and each file name says a behaviour.
- Feature: each symbol imported from the file that declares it; no file that only passes exports on.
- Boundary: a boundary reads its input, calls one feature function, and maps the result. Zero decisions.
- Types: each outside value validated at the edge; each illegal state impossible to build.
- Types: no cast, no suppression and no escape hatch.
- Comment: three cases only, an external constraint, the origin of a number, or a departure.
- Comment: three lines or fewer, and 100 characters or fewer on a line.
- Comment: no document path, no section mark and no ticket number.
- Comment: no sentence about an earlier state, and no sentence the change made false.
- Stop: the stack is chosen. Nothing is installed to try it.
`

const CHOSEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['identity', 'tickets', 'skipped'],
  properties: {
    identity: { type: 'string', description: 'the login gh api user printed' },
    tickets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'title', 'type', 'asks', 'done', 'isChild', 'claimed'],
        properties: {
          number: { type: 'integer' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['task', 'research'] },
          asks: { type: 'string', description: 'the work the ticket names, in one sentence' },
          done: { type: 'string', description: 'what makes this ticket done, from its body' },
          isChild: { type: 'boolean', description: 'true where the body says Part of #1' },
          claimed: { type: 'boolean', description: 'true where the assignee is now set' },
        },
      },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'why'],
        properties: { number: { type: 'integer' }, why: { type: 'string' } },
      },
    },
  },
}

const WORK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['result', 'summary', 'files', 'check', 'rules', 'assumed', 'ask'],
  properties: {
    result: { type: 'string', enum: ['DONE', 'PARTIAL', 'BLOCKED'] },
    summary: { type: 'string', description: 'what the change does, in one sentence' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'reason'],
        properties: { path: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    check: { type: 'string', description: 'each command run and its status, or none' },
    rules: { type: 'string', description: 'each failed rule test, or none' },
    assumed: {
      type: 'array',
      description: 'each assumption, its cost, and what proves it wrong',
      items: { type: 'string' },
    },
    ask: {
      type: 'array',
      description: 'each question for the operator, in four parts, or empty',
      items: { type: 'string' },
    },
  },
}

const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['finding', 'evidence', 'recommend', 'cost', 'provesItWrong', 'operatorNeeded', 'operatorWhy'],
  properties: {
    finding: { type: 'string', description: 'the answer the ticket asked for, in one sentence' },
    evidence: {
      type: 'array',
      description: 'each fact that holds the finding, with the file, the version or the source',
      items: { type: 'string' },
    },
    recommend: { type: 'string', description: 'the smallest next step, or none' },
    cost: { type: 'string', description: 'what the recommendation gives up' },
    provesItWrong: { type: 'string' },
    operatorNeeded: { type: 'boolean' },
    operatorWhy: { type: 'string', description: 'which of the five tests is true, or empty' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'findings', 'smaller', 'scope'],
  properties: {
    verdict: { type: 'string', enum: ['accept', 'refuse'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'part', 'why', 'fix'],
        properties: {
          file: { type: 'string' },
          part: { type: 'string', description: 'the part to cut or to change' },
          why: { type: 'string', description: 'the rule it breaks, or what stays unbroken if it is deleted' },
          fix: { type: 'string', description: 'the smaller thing that holds' },
        },
      },
    },
    smaller: { type: 'string', description: 'a smaller solution to the whole ticket, or empty' },
    scope: { type: 'string', description: 'each part of the diff the ticket did not ask for, or none' },
  },
}

const REPAIR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['result', 'summary', 'files', 'check', 'applied', 'refused', 'ask'],
  properties: {
    result: { type: 'string', enum: ['DONE', 'PARTIAL', 'BLOCKED'] },
    summary: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'reason'],
        properties: { path: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    check: { type: 'string' },
    applied: { type: 'array', items: { type: 'string' }, description: 'each finding applied' },
    refused: {
      type: 'array',
      items: { type: 'string' },
      description: 'each finding not applied, and the fact that refuses it',
    },
    ask: { type: 'array', items: { type: 'string' } },
  },
}

const RESOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['closed', 'comment', 'mapPointer', 'leftOpenWhy'],
  properties: {
    closed: { type: 'boolean' },
    comment: { type: 'string', description: 'the comment written on the ticket' },
    mapPointer: {
      type: 'string',
      description: 'one line for the map, or empty where the ticket is not a child or is not closed',
    },
    leftOpenWhy: { type: 'string', description: 'why the ticket stays open, or empty' },
  },
}

const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['appended', 'lines', 'note'],
  properties: {
    appended: { type: 'boolean' },
    lines: { type: 'array', items: { type: 'string' } },
    note: { type: 'string', description: 'what the map still needs from the operator, or none' },
  },
}

const head = (text) => (text.length > 44 ? text.slice(0, 41) + '...' : text)

const asNumbers = (given) => {
  if (typeof given === 'number') return [given]
  if (typeof given === 'string' && given.trim() !== '')
    return given.split(/[^0-9]+/).filter(Boolean).map(Number)
  if (Array.isArray(given)) return given.map(Number).filter((one) => !Number.isNaN(one))
  return null
}

const ticketHead = (ticket) =>
  `
The ticket: #` +
  ticket.number +
  ' ' +
  ticket.title +
  `
It asks: ` +
  ticket.asks +
  `
It is done when: ` +
  ticket.done +
  `
Read it yourself first: gh issue view ` +
  ticket.number +
  ` --comments
The ticket body is the authority, and the summary above is not.
`

phase('Choose')

const named = asNumbers(args)

const chosen = await agent(
  HOUSE +
    `
Open the queue of this run. You write to the tracker, so read docs/agents/issue-tracker.md and
docs/agents/wayfinder-tracker.md first.

Print your identity before any write: gh api user --jq .login
Where it is not gabriel-neutron, claim nothing and return an empty ticket list with that login.

` +
    (named === null
      ? `List the queue:
gh issue list --label ready-for-agent --state open --limit 100 --json number,title,labels,assignees
Take the tickets in tracker order and keep the first ` + MAX_TICKETS + ` that pass every test below.`
      : `The operator named these tickets: ` +
        named.join(', ') +
        `
Take them in that order, and keep each one that passes every test below.`) +
    `

Drop a ticket where one is true. Say which, in the skipped list.
- It has an assignee. Another session holds it.
- It is blocked. Read the live gate:
  gh api repos/{owner}/{repo}/issues/<n> --jq .issue_dependencies_summary.blocked_by
  A count above zero drops it. Read a "Blocked by:" line in the body as well.
- It is closed, or it lost the ready-for-agent label since the list was made.

For each ticket you keep, read the whole body and every comment. Then give:
- its type. A wayfinder:research label is research. Every other ticket is a task, and a ticket
  with no wayfinder: label is a task.
- what it asks, in one sentence.
- what makes it done, taken from its body and never invented.
- whether its body says "Part of #` +
    MAP_ISSUE +
    `".

Then claim each ticket you keep: gh issue edit <n> --add-assignee @me
This is the only write of this step. Do not comment. Do not close. Do not label.`,
  { label: 'choose and claim the queue', phase: 'Choose', schema: CHOSEN_SCHEMA },
)

if (chosen === null) return { ran: [], note: 'the queue step returned nothing' }

if (chosen.identity !== 'gabriel-neutron')
  return {
    ran: [],
    skipped: chosen.skipped,
    note: 'the run stopped: gh acts as ' + chosen.identity + ', and every write must act as gabriel-neutron',
  }

let queue = chosen.tickets.filter((one) => one.claimed)

if (queue.length === 0)
  return { ran: [], skipped: chosen.skipped, note: 'no ticket was free to claim' }

if (queue.length > MAX_TICKETS) {
  const dropped = queue.slice(MAX_TICKETS).map((one) => '#' + one.number).join(', ')
  log(queue.length + ' tickets claimed. This run works the first ' + MAX_TICKETS + '. Not covered: ' + dropped)
  queue = queue.slice(0, MAX_TICKETS)
}

if (chosen.skipped.length > 0)
  log('Skipped: ' + chosen.skipped.map((one) => '#' + one.number + ' ' + one.why).join(' | '))

log(
  'Working ' +
    queue.length +
    ' one after the other: ' +
    queue.map((one) => '#' + one.number + ' ' + one.type).join(', '),
)

const done = []

for (let index = 0; index < queue.length; index += 1) {
  const ticket = queue[index]
  const tag = '#' + ticket.number + ' ' + head(ticket.title)

  // A research ticket produces a finding, and never a diff. A code review of it has nothing to
  // read, so it skips the review and the repair.
  if (ticket.type === 'research') {
    const study = await agent(
      HOUSE +
        ESCALATION +
        ticketHead(ticket) +
        `
This ticket is research. It produces a finding, and never a diff. Write no source file.

Answer the question the ticket asks. Read the repository for what is installed and what depends
on it: package.json, the lock file, the SQL under db/, the compose file, and the code that calls
the thing under study. Read the upstream facts where you can reach them.

Give the finding in one sentence, then each fact that holds it, with the file, the version or the
source that carries it. Give the smallest next step, and what it gives up. Give the fact that
would prove the finding wrong. Say whether the operator must decide, and which of the five tests
is true. Where none is true, decide.`,
      { label: 'research: ' + tag, phase: 'Solve', schema: RESEARCH_SCHEMA },
    )

    done.push({ ticket, kind: 'research', study, review: null, repair: null })
    continue
  }

  const work = await agent(
    HOUSE +
      ESCALATION +
      ticketHead(ticket) +
      `
Do the work this ticket names. Apply every rule of your brief to every file you touch.

Take the simplest and the most minimal solution. Write what the ticket asks for, and nothing
beyond it. A part that answers a question the ticket did not ask is a fault, and a reviewer
removes it after you.

Run pnpm check when you have changed a file. Do not commit.`,
    { label: 'solve: ' + tag, phase: 'Solve', agentType: 'gab-coder', schema: WORK_SCHEMA },
  )

  if (work === null) {
    done.push({ ticket, kind: 'task', work: null, review: null, repair: null })
    continue
  }

  // Nothing was written, so there is no diff to review.
  if (work.files.length === 0) {
    log(tag + ': ' + work.result + ', and no file changed. The review is skipped.')
    done.push({ ticket, kind: 'task', work, review: null, repair: null })
    continue
  }

  const review = await agent(
    HOUSE +
      SIMPLEST +
      RULES +
      ticketHead(ticket) +
      `
An agent solved this ticket. Read what it changed, and judge the diff.

What it says it did: ` +
      work.summary +
      `
Its result: ` +
      work.result +
      `
The files it touched:
` +
      work.files.map((one) => '- ' + one.path + ': ' + one.reason).join('\n') +
      `
What it assumed: ` +
      (work.assumed.join('; ') || 'none') +
      `

Read the diff yourself with: git diff
Read each changed file whole, because a diff hides the shape of the file it sits in.

Refuse the diff where a part of it is larger than the ticket asked for, where a smaller solution
holds the same guarantees, or where it breaks a rule above. Accept it where none of the three is
true. Name each finding with its file, the part, the rule it breaks or what stays unbroken when
it is deleted, and the smaller thing that holds.

Judge the code, and never the correctness of the answer to the ticket.`,
    { label: 'review: ' + tag, phase: 'Review', schema: REVIEW_SCHEMA },
  )

  let repair = null

  // One repair pass, and never a second. An unbounded review loop is the risk the operator named.
  if (review !== null && review.verdict === 'refuse' && review.findings.length > 0) {
    log(tag + ': the review refused, with ' + review.findings.length + ' findings. One repair pass runs.')

    repair = await agent(
      HOUSE +
        ESCALATION +
        SIMPLEST +
        ticketHead(ticket) +
        `
You solved this ticket, and a reviewer refused the diff. Apply the review, once.

The findings:
` +
        review.findings
          .map((one) => '- ' + one.file + ' | ' + one.part + ' | ' + one.why + ' | smaller: ' + one.fix)
          .join('\n') +
        `
A smaller whole solution: ` +
        (review.smaller || 'none given') +
        `
Beyond the scope of the ticket: ` +
        review.scope +
        `

The reviewer removes work, so your diff after this pass is smaller than before it, or the same
size. It is never larger. Refuse a finding only on a fact in the repository that breaks it, and
name that fact. Do not argue from taste.

Run pnpm check again. Do not commit. This is the only repair pass; there is no second review.`,
      { label: 'repair: ' + tag, phase: 'Repair', agentType: 'gab-coder', schema: REPAIR_SCHEMA },
    )
  }

  done.push({ ticket, kind: 'task', work, review, repair })
}

phase('Resolve')

// An agent reports on its own step, and it does not see the steps after it. A solver that says
// DONE, and then leaves a question or a review finding unapplied, is PARTIAL for the whole run.
const stateOf = (one) => {
  if (one.kind === 'research') {
    if (one.study === null) return null
    return { result: one.study.operatorNeeded ? 'PARTIAL' : 'DONE' }
  }
  const last = one.repair || one.work
  if (last === null) return null
  const asked = (one.work === null ? 0 : one.work.ask.length) + (one.repair === null ? 0 : one.repair.ask.length)
  if (last.result === 'DONE' && asked > 0) return { result: 'PARTIAL' }
  return { result: last.result }
}

const recordOf = (one) => {
  if (one.kind === 'research') {
    if (one.study === null) return 'The research agent returned nothing.'
    return (
      'finding: ' +
      one.study.finding +
      '\nevidence:\n' +
      one.study.evidence.map((each) => '- ' + each).join('\n') +
      '\nrecommend: ' +
      one.study.recommend +
      '\ncost: ' +
      one.study.cost +
      '\nproves it wrong: ' +
      one.study.provesItWrong +
      '\noperator must decide: ' +
      one.study.operatorNeeded +
      ' ' +
      one.study.operatorWhy
    )
  }
  if (one.work === null) return 'The solve agent returned nothing.'
  const parts = [
    'result: ' + one.work.result,
    'did: ' + one.work.summary,
    'files:\n' + one.work.files.map((each) => '- ' + each.path + ': ' + each.reason).join('\n'),
    'check: ' + one.work.check,
    'failed rules: ' + one.work.rules,
    'assumed: ' + (one.work.assumed.join('; ') || 'none'),
    'questions: ' + (one.work.ask.join(' | ') || 'none'),
  ]
  if (one.review !== null)
    parts.push(
      'review: ' +
        one.review.verdict +
        '\nfindings:\n' +
        (one.review.findings.map((each) => '- ' + each.file + ': ' + each.why).join('\n') || '- none') +
        '\nbeyond scope: ' +
        one.review.scope,
    )
  if (one.repair !== null)
    parts.push(
      'repair: ' +
        one.repair.result +
        ' ' +
        one.repair.summary +
        '\napplied: ' +
        (one.repair.applied.join('; ') || 'none') +
        '\nrefused: ' +
        (one.repair.refused.join('; ') || 'none') +
        '\ncheck: ' +
        one.repair.check,
    )
  return parts.join('\n')
}

const resolved = []

for (const one of done) {
  const state = stateOf(one)
  const tag = '#' + one.ticket.number + ' ' + head(one.ticket.title)

  const outcome = await agent(
    HOUSE +
      `
Write the result of this ticket on the tracker. Read docs/agents/issue-tracker.md for the
identity rule and every gh operation. Confirm gh api user --jq .login prints gabriel-neutron
before your first write. Where it does not, write nothing and say so.

The ticket: #` +
      one.ticket.number +
      ' ' +
      one.ticket.title +
      `
It asked: ` +
      one.ticket.asks +
      `
It is done when: ` +
      one.ticket.done +
      `
It is a child of the map: ` +
      one.ticket.isChild +
      `

The record of the run:
` +
      recordOf(one) +
      `

Write one comment on the ticket with gh issue comment. State what was done, what was assumed,
and what the operator must still read. Keep it short, and state no fact the record above does
not hold. The diff is uncommitted, and the comment says so.

Then close the ticket with gh issue close ONLY where every one of these is true:
- the result above is DONE,
- no review finding stayed unapplied without a fact that refuses it,
- the record holds no question for the operator.
Where one is false, leave the ticket open, remove nothing, and say in one sentence why.

Where you close a ticket that is a child of the map, give one line for the map: the ticket
number, the answer in a few words, and the link to your comment. Where you do not close it, or
it is not a child, give an empty line.

Do not edit issue #` +
      MAP_ISSUE +
      ` yourself. Another agent appends every line at the end of the run.
Do not remove the ready-for-agent label, and do not change the assignee.`,
    { label: 'resolve: ' + tag, phase: 'Resolve', schema: RESOLVE_SCHEMA },
  )

  resolved.push({
    number: one.ticket.number,
    title: one.ticket.title,
    type: one.ticket.type,
    result: state === null ? 'no result' : state.result,
    reviewed: one.kind === 'task' && one.review !== null ? one.review.verdict : 'not reviewed',
    repaired: one.repair !== null,
    closed: outcome === null ? false : outcome.closed,
    leftOpenWhy: outcome === null ? 'the resolve agent returned nothing' : outcome.leftOpenWhy,
    mapPointer: outcome === null ? '' : outcome.mapPointer,
    ask:
      one.kind === 'research'
        ? one.study === null
          ? []
          : one.study.operatorNeeded
            ? [one.study.operatorWhy]
            : []
        : one.work === null
          ? []
          : one.work.ask,
  })
}

const pointers = resolved.filter((one) => one.closed && one.mapPointer.trim() !== '')

if (pointers.length === 0)
  return {
    ran: resolved,
    skipped: chosen.skipped,
    map: null,
    note: 'no ticket closed as a child of the map, so the map was not touched',
  }

phase('Map')

const map = await agent(
  HOUSE +
    `
Append these pointers to the wayfinding map, issue #` +
    MAP_ISSUE +
    `. Read docs/agents/wayfinder-tracker.md
for the resolve rule, and docs/agents/issue-tracker.md for the identity rule. Confirm
gh api user --jq .login prints gabriel-neutron before the write.

The pointers, one for each child ticket closed in this run:
` +
    pointers.map((one) => '- ' + one.mapPointer).join('\n') +
    `

Read the map body first: gh issue view ` +
    MAP_ISSUE +
    ` --json body
Append each line to the "Decisions so far" section, under the text that is already there. Change
no other section, and delete nothing. Write the whole body back once with gh issue edit --body-file
and a heredoc, so that one edit carries every line.

Then read the map against the tracker and say in one sentence what it still needs from the
operator. Report it; do not repair it.`,
  { label: 'append ' + pointers.length + ' pointers to the map', phase: 'Map', schema: MAP_SCHEMA },
)

return { ran: resolved, skipped: chosen.skipped, map }
