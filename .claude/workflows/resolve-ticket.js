// Resume note: on a resume, the review round counter starts again at 1. A resumed ticket can get
// up to maxRounds more rounds.
export const meta = {
  name: 'resolve-ticket',
  description:
    'Resolve GitHub tickets of GAB end to end: triage -> propose (debate on a real choice) -> independent design review -> test-first implementation -> review panel and gatekeeper (change-request loop) -> merge into staging and close the ticket',
  whenToUse:
    'Resolve one or more open GAB tickets with nobody in the loop, by hand or at night on the VPS. args: {tickets: [{n: 212, after?: [198]}], maxRounds?: 3, reportIssue?: <n>} names the tickets. With no tickets, args: {phase: <phase ticket>, reportIssue?: <n>, max?: 4} takes the ready-for-agent sub-issues of that phase that have no open blocker and no assignee, in tracker order. Tickets run one after the other, except two tickets whose triage found concrete, disjoint paths outside the hotspots. `after` is a hard dependency: the dependent ticket is skipped when its dependency fails. reportIssue receives the run table. main?: the path of the main checkout, default /home/claude/projects/GAB (the VPS).',
  phases: [
    { title: 'Preflight', detail: 'identity, staging branch, disposable stack; with no tickets given, choose the queue of the phase' },
    { title: 'Triage', detail: 'per ticket: still current? duplicate? open PR, branch or assignee? what does it touch?' },
    { title: 'Propose', detail: 'draft a solution; debate it (advocates + anti-overengineering agent + judge) when the choice is real' },
    { title: 'Design review', detail: 'an independent agent checks the proposal before any code is written (one rework loop)' },
    { title: 'Implement', detail: 'claim, test first, implement on fix/<n>-<slug>, commit, draft PR to staging' },
    { title: 'Review', detail: 'spec and standards reviewers (+ a risk lens when triage flags one), then an independent gatekeeper' },
    { title: 'Fix', detail: 'apply the change requests of the gatekeeper, and loop' },
    { title: 'Merge', detail: 'one at a time: rebase, check again, merge into staging, close the ticket' },
    { title: 'Report', detail: 'comments on flagged and blocked tickets, the run table, worktree cleanup' },
  ],
}

const REPO = 'gabriel-neutron/GAB'

// The allow list of the VPS accepts only literal paths, because a shell substitution in a command
// can run any program. So the path of the main checkout is a literal in each prompt. The default is
// the VPS checkout; a run on another machine gives args.main.
const MAIN_WORKTREE = (args && args.main) || '/home/claude/projects/GAB'
const COMPOSE = `docker compose -f ${MAIN_WORKTREE}/infra/docker-compose.yml`

const MAX_ROUNDS = (args && args.maxRounds) || 3

// Four tickets per night run. The operator chose it: four tickets cost about sixty agents, and
// the morning report must stay readable in one sitting.
const MAX_TICKETS = (args && args.max) || 4

const GIVEN = (args && args.tickets) || []
const PHASE_TICKET = args && args.phase
if (!GIVEN.length && !PHASE_TICKET)
  throw new Error('Give args.tickets, e.g. {tickets:[{n:212}]}, or args.phase, e.g. {phase:150}')

const HOUSE = `
You work on the GAB project, repository ${REPO}, on a Linux VPS. Nobody watches this run.

Read docs/README.md first. It routes each task to the document that governs it.
Read docs/spec.md for the invariants, the read path and the write path.
Read docs/decisions.md for a named entry such as M8, P1 or T5. That register is locked.
Read an ADR under docs/adr/ when the work touches the runtime, the schema, the frontend, the map,
a comment, a role or a tool. Read the SQL under db/ for the authority on a constraint, never a
document.

The facts of this run. One operator, who is asleep. A VPS with Docker. A disposable local stack of
PostgreSQL with PostGIS and pgvector, MinIO and PostgREST, on the loopback address alone. Its
databases hold no record of value: you may reset them. TypeScript on both sides. No team.

Rules that bind every agent of this run:
1. Never push to main, never merge into main, and never force-push staging. The operator alone
   promotes staging to main.
2. The operator owns docs/. Never write a file under docs/, not with a tool and not with the
   shell. When the work needs a change there, post it as a question on the ticket.
3. Never change .claude/skills, .claude/agents, .claude/hooks or .claude/settings.json.
4. Every write to GitHub acts as gabriel-neutron. Confirm it with: gh api user --jq .login
   Never run gh auth login or gh auth switch. Never print or copy a token or an env file.
5. pnpm check is the conformance command. It runs the drift check, so it needs the running stack.
   pnpm test is the test command. Read only the failing tail of an output.
6. Never point a command at a database or a host other than the local disposable stack.
`

// The five cases are the ESCALATION block of the other GAB workflows. An autonomous run still
// asks the operator for what the five reserve, and decides all else itself.
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

const CTX = n => `${HOUSE}
Your ticket: #${n} of ${REPO}. The ticket body and its comments are the spec. Read them yourself:
gh issue view ${n} --repo ${REPO} --comments`

// The commit rule of the repository gives the commit to the orchestrating session. Here the
// implementer commits on its own ticket branch only, and the gatekeeper is the second reader that
// the rule asks for: nothing reaches staging before that reader approves.
const COMMIT = n => `Commit on your ticket branch only. Read docs/agents/commit.md for the format:
- header: type(scope): a lower case sentence that says what the commit made true, no full stop;
- body in ASD-STE100 Simplified Technical English, each claim in bold: the defect or the reason
  first, then what changed, then the cost; name each command you ran and its result;
- trailer: Closes #${n} (or Refs #${n} for a partial step), then:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
A reference to a ticket, a document or a section goes in the commit message, never in a comment
under src/, packages/*/src or .storybook.`

// A worktree holds no env file, because .gitignore keeps it out. A link reaches the file of the
// main checkout without a second copy of the secrets on the disk.
const SETUP = `Set up your worktree before any pnpm command:
- If infra/.env is absent: ln -s ${MAIN_WORKTREE}/infra/.env infra/.env  (a link, never a copy; never print it)
- If node_modules is absent or stale: pnpm install --frozen-lockfile`

// The stack holds one schema state at a time, and each worktree can want another. The lock of
// this script gives one agent the stack at a time, and this step moves the stack to that tree.
const DB_SYNC = `The local stack is disposable, and you hold the lock on it. Before pnpm check or
pnpm test, bring it to the tree you have checked out:
1. pnpm db:migrate, then pnpm db:reset (it builds gabriel_test again from this tree).
2. If a command says the ledger holds an ordered file that this tree does not hold, build the
   stack again from zero: ${COMPOSE} down -v
   then ${COMPOSE} up -d
   then ${COMPOSE} up -d --wait db
   then do step 1 again. Type each command exactly as it is written here.
3. If the stack does not answer, start it with the two up commands above. Docker is not a reason
   to stop.
4. If infra/.env sets GABRIEL_DB_HOST or RAW_STORE_ENDPOINT to an address that is not 127.0.0.1
   or localhost, stop and return blocked: "the env file does not point at the disposable stack".`

// The whole suite runs in one command. The vitest configuration refuses a run that holds no
// credential for the stack, so a missing database fails loudly and never shows green.
const TESTS = `pnpm test runs the whole suite: the offline project, the storybook project and the
live projects (store, writer, worker, contract, schema, perimeter, corpus, service). To run one
file: pnpm test <path>. Never set OFFLINE=1 to make a red run green.`

// The operator accepted these failures of origin/staging on 2026-10-04. A branch passes the gate when
// it adds no failure to them. Any other red is a new red, also in a file the branch does not touch.
const BASELINE = `ACCEPTED BASELINE of origin/staging. These failures exist on staging, and they do not
block a PR:
- pnpm check: TS2375 at src/features/detail/sidebar.tsx(77,10); lint errors and format faults
  that origin/staging also shows.
- pnpm test: 6 tests that need an object store at 127.0.0.1:9000 (5 in
  packages/store/src/object.db-test.ts, 1 in packages/worker/src/claim.db-test.ts), and the story
  'The Way Back From The Promotion Question Is Whole' in src/features/review/decide.stories.tsx.
The operator accepted the baseline. It is never a reason to stop, to refuse a merge or to ask the
operator again. The rule "any red is red" does not apply to it.
A run is green when its failures are the same set or a smaller set. Prove it: run the same command
on origin/staging and compare the failing names. Any failure that staging does not show is a new
red, and it blocks the PR.`

const TRIAGE = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['proceed', 'flagged_duplicate', 'flagged_stale', 'flagged_in_progress'] },
    duplicate_of: { type: 'integer' },
    reason: { type: 'string', description: 'for flagged_*: the finding and its evidence (PR, branch, commit or issue links)' },
    touched_paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'concrete repo-relative files or folders this ticket will likely change; a glob only where you cannot narrow it',
    },
    risk_lens: {
      type: 'string',
      enum: ['none', 'schema', 'evidence'],
      description: 'schema when db/migrations or db/apply changes; evidence when the change can move a row to the evidentiary layer, promote, decide, or sign as the operator',
    },
  },
  required: ['status', 'touched_paths', 'risk_lens'],
}

const PREFLIGHT = {
  type: 'object',
  properties: {
    identity: { type: 'string', description: 'the login that gh api user printed' },
    staging: { type: 'boolean', description: 'true when origin/staging exists' },
    stack: { type: 'string', description: 'ok, or why the disposable stack is not usable' },
    tickets: { type: 'array', items: { type: 'integer' }, description: 'the chosen queue, in tracker order; empty when tickets were given' },
    skipped: {
      type: 'array',
      items: { type: 'object', properties: { n: { type: 'integer' }, why: { type: 'string' } }, required: ['n', 'why'] },
    },
  },
  required: ['identity', 'staging', 'stack', 'tickets', 'skipped'],
}

const PROPOSAL = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: { type: 'string' },
      description: '1 candidate, unless 2-4 approaches stay viable with real tradeoffs after the facts are checked',
    },
  },
  required: ['candidates'],
}

const DEBATE = {
  type: 'object',
  properties: {
    position: { type: 'string' },
    objections_to_rivals: { type: 'array', items: { type: 'string' } },
    where_i_would_be_wrong: { type: 'string' },
  },
  required: ['position', 'objections_to_rivals', 'where_i_would_be_wrong'],
}
const ANTI_DEBATE = {
  ...DEBATE,
  properties: {
    ...DEBATE.properties,
    minimal_alternative: { type: 'string', description: 'only when every candidate is overbuilt: the concrete minimal approach' },
  },
}

const JUDGE = {
  type: 'object',
  properties: {
    chosen: { type: 'string', description: 'the approach text to implement (it can be the minimal_alternative)' },
    reason: { type: 'string' },
  },
  required: ['chosen', 'reason'],
}

const DESIGN_REVIEW = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['sound', 'needs_rework'] },
    concerns: { type: 'array', items: { type: 'string' } },
    approved_approach: { type: 'string' },
  },
  required: ['verdict', 'approved_approach'],
}

const IMPL = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pr_opened', 'blocked', 'needs_human_prerequisite'] },
    branch: { type: 'string' },
    pr_number: { type: 'integer', description: 'REQUIRED when status=pr_opened' },
    red_evidence: { type: 'string' },
    green_evidence: { type: 'string' },
    migrations: { type: 'array', items: { type: 'string' }, description: 'each new file under db/migrations' },
    blocked_reason: { type: 'string' },
    prerequisites: {
      type: 'array',
      items: { type: 'string' },
      description: 'for needs_human_prerequisite: what only the operator can do or decide (a docs/ change, one of the five questions, a secret)',
    },
  },
  required: ['status', 'branch', 'red_evidence', 'green_evidence', 'migrations'],
}

const REVIEW = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes_requested'] },
    blocking: {
      type: 'array',
      items: {
        type: 'object',
        properties: { file: { type: 'string' }, issue: { type: 'string' }, required_change: { type: 'string' } },
        required: ['issue', 'required_change'],
      },
    },
    non_blocking: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'blocking', 'non_blocking'],
}

const GATE = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes_requested'] },
    red_on_staging_confirmed: { type: 'boolean' },
    green_on_branch_confirmed: { type: 'boolean' },
    check: { type: 'string', description: 'pnpm check: status and the failing tail if red' },
    tests: { type: 'string', description: 'pnpm test: status and the failing tail if red' },
    change_requests: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['verdict', 'red_on_staging_confirmed', 'green_on_branch_confirmed', 'check', 'tests', 'change_requests', 'summary'],
}

const MERGE = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['merged_and_closed', 'needs_changes', 'failed'] },
    check_green: { type: 'boolean', description: 'true when pnpm check shows no failure beyond the accepted baseline of staging. The baseline failures themselves do not make it false.' },
    tests_green: { type: 'boolean', description: 'true when pnpm test shows no failure beyond the accepted baseline of staging. The baseline failures themselves do not make it false.' },
    merge_sha: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['status', 'check_green', 'tests_green', 'reason'],
}

// --- Stage: Preflight. One agent proves the run can write as the right account, onto staging,
// against the disposable stack, before any ticket is touched. With no tickets, it also chooses.

phase('Preflight')

const preflight = await agent(
  `${HOUSE}
You run the PREFLIGHT of a resolve-ticket run. Read docs/agents/issue-tracker.md and
docs/agents/wayfinder-tracker.md first. Do not comment, label or close anything. Claim a ticket
only in step 4, and only when step 4 tells you to.

1. gh api user --jq .login  -> identity. If it is not gabriel-neutron, stop here and return it.
2. git fetch origin; git ls-remote --heads origin staging  -> staging is true when it exists.
3. Read only the variable names of ${MAIN_WORKTREE}/infra/.env, never the values:
   it must exist, and GABRIEL_DB_HOST and RAW_STORE_ENDPOINT must be absent or point at
   127.0.0.1 or localhost. Then ${COMPOSE} ps
   must show the db service up. If it is down: ${COMPOSE} up -d
   then ${COMPOSE} up -d --wait db
   Type each command exactly as it is written here. stack = "ok", or the reason.
` +
    (GIVEN.length
      ? `4. The tickets are given: ${GIVEN.map(t => '#' + t.n).join(', ')}. Return tickets=[] and skipped=[].`
      : `4. Choose the queue of phase ticket #${PHASE_TICKET}:
   gh api repos/${REPO}/issues/${PHASE_TICKET}/sub_issues --paginate
   Keep the sub-issues in that order. Keep a sub-issue only when all of these are true:
   - it is open and it has the ready-for-agent label;
   - it has no assignee;
   - gh api repos/${REPO}/issues/<n> --jq .issue_dependencies_summary.blocked_by  prints 0,
     and no "Blocked by:" line in its body names an open issue.
   Put each dropped sub-issue in skipped with the reason. Return the first ${MAX_TICKETS} kept
   ones in tickets, and put each further kept one in skipped with "over the cap of this run".
5. Claim each ticket that you return in tickets at once, before you return:
   gh issue edit <n> --repo ${REPO} --add-assignee @me
   The ready-for-agent-run workflow drops a ticket that has an assignee, so the claim keeps it
   from the same ticket. If a claim fails, move that ticket to skipped with the error.`),
  { label: 'preflight', phase: 'Preflight', schema: PREFLIGHT },
)

if (!preflight) throw new Error('the preflight agent returned nothing')
if (preflight.identity !== 'gabriel-neutron')
  return { ran: [], note: `stopped: gh acts as ${preflight.identity}, and every write must act as gabriel-neutron` }
if (!preflight.staging) return { ran: [], note: 'stopped: origin/staging does not exist. The operator creates it from main.' }
if (preflight.stack !== 'ok') return { ran: [], note: `stopped: the disposable stack is not usable: ${preflight.stack}` }
if (preflight.skipped.length) log('Skipped: ' + preflight.skipped.map(s => `#${s.n} ${s.why}`).join(' | '))

const TICKETS = GIVEN.length ? GIVEN : preflight.tickets.slice(0, MAX_TICKETS).map(n => ({ n }))
if (!TICKETS.length) return { ran: [], skipped: preflight.skipped, note: `no free ready-for-agent sub-issue under #${PHASE_TICKET}` }
log(`Tickets of this run: ${TICKETS.map(t => '#' + t.n).join(', ')}`)

// --- Stage: Triage (all tickets, in parallel; read-only and cheap) ---

const triagePrompt = n => `${CTX(n)}
You TRIAGE ticket #${n}. READ-ONLY: no edits, no commits, no GitHub writes.
1. gh issue view ${n} --repo ${REPO} --json title,body,labels,comments,assignees. Read the comments:
   they can say that the work is done, moved or re-scoped.
2. Assignee: gabriel-neutron is the identity of this run, and the preflight of this run claims
   each ticket of its queue. So an assignee gabriel-neutron is the claim of this run, and not work
   in progress. If anyone other than gabriel-neutron holds it, status=flagged_in_progress.
3. Existing work: gh pr list --repo ${REPO} --state open --search "${n} in:body", a search by title
   words, and git ls-remote --heads origin for a branch that contains ${n}. An open PR or a live
   branch for this ticket gives flagged_in_progress with the link.
4. Still current? git fetch origin, then read the code the ticket names on origin/main and on
   origin/staging. Fixed on staging but not on main: flagged_stale ("fixed on staging, waits for
   the promotion" + the commit). Fixed everywhere, or the symptom is gone: flagged_stale.
5. Duplicates: gh issue list --repo ${REPO} --state open --json number,title,body. Another OPEN
   issue with the same root problem gives flagged_duplicate with duplicate_of.
6. Else status=proceed. List the concrete files and folders this fix will touch. They decide
   whether two tickets can run at the same time, so be concrete; a glob makes the run sequential.
7. risk_lens=schema when the fix changes db/migrations or db/apply. risk_lens=evidence when it can
   move a row to the evidentiary layer, promote or reject a proposal, decide by rule, or sign as
   the operator (P1, the writer doors, decide_by_rule). Else none. Evidence wins over schema.
For each flagged_* status, put the finding and its evidence in reason.`

const triageResults = await parallel(TICKETS.map(t => () => agent(triagePrompt(t.n), { label: `triage #${t.n}`, phase: 'Triage', schema: TRIAGE })))
const triageByN = Object.fromEntries(
  TICKETS.map((t, i) => [t.n, triageResults[i] ? { n: t.n, ...triageResults[i] } : { n: t.n, status: 'error', reason: 'triage failed' }]),
)

// A ticket waits for each earlier ticket unless both have concrete, disjoint paths outside the
// hotspots. A hotspot is a file that many tickets touch, or one that a generator writes from the
// schema, so two tickets there conflict even when their own paths differ.
const HOTSPOTS = [
  'db/migrations', 'db/apply', 'src/contract', 'src/db', 'src/routetree.gen.ts', 'infra',
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'eslint.config.ts', 'vitest.config.ts',
  'tsconfig.base.json', '.env',
]
const norm = p => p.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '').toLowerCase()
const concrete = ps => Array.isArray(ps) && ps.length > 0 && ps.every(p => p.trim() && !/[*{?]/.test(p))
const under = (p, q) => p === q || p.startsWith(q + '/')
const hot = p => HOTSPOTS.some(h => ('/' + p).includes('/' + h))
const canParallel = (a, b) => {
  if (!concrete(a) || !concrete(b)) return false
  const [A, B] = [a.map(norm), b.map(norm)]
  return ![...A, ...B].some(hot) && !A.some(p => B.some(q => under(p, q) || under(q, p)))
}

const userAfter = {}, seqAfter = {}, settle = {}, finished = {}
for (const [i, t] of TICKETS.entries()) {
  userAfter[t.n] = t.after || []
  seqAfter[t.n] = TICKETS.slice(0, i).map(e => e.n).filter(e => {
    const par = canParallel(triageByN[e].touched_paths, triageByN[t.n].touched_paths)
    log(`#${t.n} vs #${e}: ${par ? 'parallel (concrete, disjoint, no hotspot)' : 'sequential'}`)
    return !par
  })
  finished[t.n] = new Promise(r => (settle[t.n] = r))
}
const reaches = (from, target, seen = new Set()) =>
  [...(userAfter[from] || []), ...(seqAfter[from] || [])].some(d => d === target || (!seen.has(d) && seen.add(d) && reaches(d, target, seen)))

// --- Per-ticket pipeline ---

const debateCandidate = (n, i, candidates) => `${CTX(n)}
You are the ADVOCATE for candidate approach ${i + 1} of ${candidates.length} for ticket #${n}:
"${candidates[i]}"
The rival candidates are:
${candidates.filter((_, j) => j !== i).map(c => `- ${c}`).join('\n')}
Argue for your approach, and attack the concrete weaknesses of each rival. Name failure modes, not
preferences. Do not change to a rival approach. State the concrete case where you are wrong.`

const antiOverengineeringPrompt = (n, candidates) => `${CTX(n)}
You are the ANTI-OVERENGINEERING reviewer for the candidate approaches of ticket #${n}:
${candidates.map((c, j) => `${j + 1}. ${c}`).join('\n')}
The rule of the operator: always take the simplest and the most minimal solution. Find and name,
in EVERY candidate, including the ones that look simple:
- a part that answers a question the ticket did not ask;
- an abstraction with one caller, or a configuration value that holds one value;
- a mode, a flag, a retry, a cache or an index that nobody asked for or measured;
- work for a deployment, a team or a scale that does not exist;
- a rule in code that repeats a rule the database already holds.
Argue for the minimal approach that solves the stated problem. Only when every candidate is
overbuilt, set minimal_alternative to a concrete minimal approach.`

const judgePrompt = (n, candidates, debates) => `${CTX(n)}
You JUDGE the approach debate for ticket #${n}. Candidates:
${candidates.map((c, j) => `${j + 1}. ${c}`).join('\n')}
Debate (advocates in candidate order, anti-overengineering last): ${JSON.stringify(debates, null, 1)}
Choose the approach that survives the strongest objections against it. Give the anti-overengineering
objections their full weight: an approach that wins only because it can do more, with no concrete
need for that capability now, loses to the simpler one. Its minimal_alternative can win. The
volume of an argument is not a reason.
${ESCALATION}
Then post ONE comment on issue #${n} in Simplified Technical English
(gh issue comment ${n} --repo ${REPO} --body-file <tmp>): "Approach decision (agent debate)", the
chosen approach, and the decisive reason. Return chosen (the full approach text) and reason.`

const proposePrompt = (n, concerns) => `${CTX(n)}
${ESCALATION}
You PROPOSE a solution for ticket #${n}. READ-ONLY: no edits, no commits.
First settle the facts: read the ticket and its comments, the code it touches, the documents that
docs/README.md routes you to, and the SQL under db/. A question of fact is answered by a check,
and never listed as a candidate.
Then: if one approach dominates, return candidates=[it]. List 2-4 candidates only when, after that
check, two approaches stay viable with real tradeoffs, and not a preference of style.${concerns ? `
A design reviewer refused the previous proposal with these concerns. Answer each one: ${JSON.stringify(concerns)}` : ''}`

const designReviewPrompt = (n, approach) => `${CTX(n)}
You are the INDEPENDENT DESIGN REVIEWER for ticket #${n}. You did not propose this. READ-ONLY.
Proposed approach: "${approach}"
Check that it solves what the ticket asks, that it fits the existing code (the domain words of
docs/agents/domain.md, the folder rules of ADR 0001, the schema rules of ADR 0003), and that it is
not larger than the problem. verdict=sound only if you accept to see it implemented as it is; else
needs_rework with concerns. Set approved_approach to the approach to implement. You can correct it
narrowly; do not invent a different approach.`

const implementPrompt = (n, approach) => `${CTX(n)}
${ESCALATION}
You IMPLEMENT ticket #${n} with this reviewed approach: "${approach}"
You are in an isolated git worktree. Steps:
1. Claim the ticket: gh issue edit ${n} --repo ${REPO} --add-assignee @me. Then git fetch origin, and
   create the branch fix/${n}-<short-kebab-slug> from origin/staging.
2. ${SETUP}
3. ${DB_SYNC}
4. TEST FIRST: write the test(s) that fail today and prove the problem of this ticket. A test that
   reaches the database is a *.db-test.ts file in the folder of its project; every other test is a
   *.test.ts file. Capture the failure output. If the problem does not reproduce, stop and return
   status=blocked with the reason.
5. Implement the approved approach. Do not go past the ticket; write anything else you see in the
   PR description. A comment under src/, packages/*/src or .storybook records a reason and never a
   reference: no path, no section mark, no ticket number.
6. A schema change goes in a new ordered file under db/migrations or in a re-runnable file under
   db/apply, and only adds: no DROP, no rename, no data loss. Run it on the disposable stack with
   step 3. It never reaches another database.
7. pnpm check and ${TESTS} must show no failure beyond the baseline. ${BASELINE} Use the test-fixer agent for a red test if
   you need it, but never weaken an assertion. pnpm check can regenerate a file under src/contract,
   src/db or src/routeTree.gen.ts: commit that file with the change.
8. If the work needs a change under docs/, do not make it. Post the exact change as a question on
   the ticket, and return status=needs_human_prerequisite with it in prerequisites. Do the same for
   a question that one of the five cases above reserves to the operator.
9. ${COMMIT(n)}
Push the branch (git push -u origin <branch>). Open a DRAFT PR to staging
(gh pr create --repo ${REPO} --base staging --draft --body-file <tmp>). The body: "Closes #${n}",
a summary, the red and green evidence, the migrations, and each assumption with its cost, in
Simplified Technical English, ending with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
If something only the operator can do stops you (a secret, a third-party account, a change to
docs/, a decision of the five cases), return status=needs_human_prerequisite with a checklist in
prerequisites instead of blocked. The stack is not such a case: step 3 starts it.
Return the structured result; pr_number is required when status=pr_opened.`

const reviewerPrompt = (n, pr, lens) => `${CTX(n)}
You are an INDEPENDENT reviewer of PR #${pr} (ticket #${n}). READ-ONLY.
gh pr view ${pr} --repo ${REPO}; gh pr diff ${pr} --repo ${REPO}. Read each changed file whole.
${lens}
Raise a BLOCKING issue only when it is real and specific: the file, what is wrong, and the change it
needs. A preference of style is non_blocking.`

// GAB has no dedicated reviewer agent type, so each lens runs as a general-purpose agent and its
// text carries the whole brief.
const LENSES = {
  spec: {
    agentType: 'general-purpose',
    text: n => `Lens: SPEC. Does the diff do exactly what ticket #${n} asks, with nothing missing and nothing
extra? A missing requirement, a requirement done wrong, or scope the ticket did not ask for is
blocking. The rule of the operator is the simplest and the most minimal solution: a part that
answers a question the ticket did not ask is blocking.`,
  },
  standards: {
    agentType: 'general-purpose',
    text: () => `Lens: STANDARDS. Check the diff against:
- CLAUDE.md: every comment, message, commit body and PR text in ASD-STE100 Simplified Technical
  English;
- ADR 0006: a comment under src/, packages/*/src or .storybook records a reason and never a
  reference (no path, no section mark, no ADR number, no ticket number); a decisions.md entry such
  as M8 stays only next to the rule it names;
- ADR 0001: the folder kinds, no feature imports another feature, shared/ imports no feature, only
  routes/ imports a feature; pnpm check green; no suppression of a lint rule;
- docs/README.md: each document that the change makes false is named as a question on the
  ticket, never edited by the agent;
- docs/agents/commit.md: the header, the STE body with each claim in bold, the trailer.`,
  },
  schema: {
    agentType: 'general-purpose',
    text: n => `Lens: SCHEMA. Ticket #${n} changes db/migrations or db/apply. Check:
- the change only adds: no DROP, no rename, no type change that loses data, no table in a
  re-runnable file;
- the SQL stays the only source of truth, and each generated file under src/contract and src/db
  matches it (pnpm check holds the drift);
- the grants keep the roles of ADR 0003 and ADR 0010: gabriel_app calls the write functions and
  writes no table; gabriel_agent and gabriel_research write the candidate layer only;
  gabriel_read reads the api schema only; put_document stays granted to gabriel_app alone.
A new grant that widens a role is blocking.`,
  },
  evidence: {
    agentType: 'general-purpose',
    text: n => `Lens: EVIDENCE. Ticket #${n} can move a row to the evidentiary layer, promote, decide or sign as
the operator. Check:
- P1: only the operator, or the source rule of ADR 0010, moves a proposal to the evidentiary
  layer; no new path skips the review queue;
- a writer door signs as the operator, so no machine caller (MCP, agent, chat) reaches /write/*;
- decide_by_rule keeps every lock: no parameter row means it does nothing; a rating from a model
  alone never counts; dissent must be false with a vote from a second model family; never
  merge_entities, a deletion, or an update that replaces a value the operator promoted; no new
  attribute key; decision_origin is written as rule:<version>.
Default to changes_requested when you find a credible path that breaks one of these.`,
  },
}

const gatePrompt = (n, pr, reviews, round) => `${CTX(n)}
You are the INDEPENDENT GATEKEEPER for PR #${pr} (ticket #${n}), round ${round}/${MAX_ROUNDS}. You are
the second reader of this diff. Do not trust the claims of the implementer: prove them again. No
edits, no commits, no merge.
You are in an isolated worktree, and you hold the lock on the stack. git fetch origin.
${SETUP}
1. RED on staging: check out origin/staging, copy in only the new or changed test files of the PR
   head, do the stack step below, and run them. They must FAIL, for the reason of the ticket.
   Discard the copy.
2. GREEN on the branch: check out the PR head, do the stack step below, run the same tests (they
   must pass), then pnpm check, then ${TESTS}. Both must show no failure beyond the baseline. ${BASELINE}
The stack step: ${DB_SYNC}
3. Read the reviews below. approve only if red and green are proven, pnpm check and pnpm test show
   no failure beyond the baseline, and no blocking issue is valid. You can dismiss a blocking issue only when you prove it
   wrong; say why. Else changes_requested, with a concrete list that a reader can verify.
Reviews: ${JSON.stringify(reviews, null, 1)}`

const fixPrompt = (n, pr, branch, gate) => `${CTX(n)}
You FIX PR #${pr} (branch ${branch}, ticket #${n}) with the change requests of the gatekeeper.
Isolated worktree: git fetch origin && git checkout ${branch}. You hold the lock on the stack.
${SETUP}
${DB_SYNC}
Apply every request. If one seems wrong, apply it anyway, or explain with evidence in a PR comment
why not. Never skip one in silence. Never weaken a test assertion. Never write under docs/.
pnpm check and ${TESTS} must show no failure beyond the baseline. ${BASELINE} ${COMMIT(n)}
Push. Post a PR comment, in Simplified Technical English, that lists each request and what you did.
Change requests: ${JSON.stringify(gate.change_requests, null, 1)}
Gatekeeper summary: ${gate.summary}
Return a short text summary of what you changed.`

const mergePrompt = (n, pr, branch, gate, impl) => `${CTX(n)}
You are the INDEPENDENT VALIDATOR who integrates an approved fix. PR #${pr}, branch ${branch},
ticket #${n}. The gatekeeper approved: ${gate.summary}
You hold the lock on staging and on the stack. Isolated worktree.
${SETUP}
1. git fetch origin; check out ${branch}; rebase it onto origin/staging. On a conflict that is not
   trivial, or on any failure below, abort and return needs_changes with the exact reason.
2. The stack step: ${DB_SYNC}
3. ${BASELINE}
   Run pnpm check and set check_green. Run ${TESTS} and set tests_green. Each flag is true when the
   run shows no failure beyond the baseline. A new red: stop, do not merge, return needs_changes
   with the failing tail. When both flags are true, push with --force-with-lease, on this branch only.
4. Migrations in this PR: ${JSON.stringify(impl.migrations)}. They run on the disposable stack only.
   No other database exists for this run: never apply one anywhere else.
5. Mark the PR ready (gh pr ready ${pr} --repo ${REPO}) and merge it with a merge commit:
   gh pr merge ${pr} --repo ${REPO} --merge --subject "merge: ${branch} into staging"
   Never touch main.
6. Close ticket #${n}: gh issue close ${n} --repo ${REPO} --comment "<body>". The body, in Simplified
   Technical English: an independent gatekeeper and reviewers validated it; it is merged into
   staging at <sha> through PR #${pr}; the red and green evidence; the pnpm check and pnpm test
   results; the migrations, if any; and "It reaches main when the operator promotes staging."
Return the structured result.`

// Every agent that runs pnpm check, pnpm test or a db command shares one disposable stack, and
// every merge shares staging. The lock gives each of them the stack and staging one at a time.
let lock = Promise.resolve()
const withLock = fn => {
  const p = lock.then(fn)
  lock = p.catch(() => {})
  return p
}

const runTicket = async t => {
  const n = t.n
  const triage = triageByN[n]
  if (triage.status !== 'proceed') {
    log(`#${n}: ${triage.status}: ${triage.reason || ''}`)
    return { n, status: triage.status, reason: triage.reason, duplicate_of: triage.duplicate_of }
  }
  const unknown = userAfter[n].find(d => !finished[d])
  if (unknown) return { n, status: 'error', reason: `after: #${unknown} is not in this run` }
  if (reaches(n, n)) return { n, status: 'error', reason: 'dependency cycle through after edges' }

  await Promise.all(seqAfter[n].map(d => finished[d]))
  const deps = await Promise.all(userAfter[n].map(d => finished[d]))
  // A list of the good results, not of the bad ones: a flagged_in_progress or flagged_duplicate
  // dependency did not land its work, and a list of bad results lets such a status through.
  const bad = deps.find(d => !['merged_and_closed', 'flagged_stale'].includes(d.status))
  if (bad) {
    log(`#${n} skipped: dependency #${bad.n} ended ${bad.status}`)
    return { n, status: 'skipped', reason: `dependency #${bad.n} ended ${bad.status}` }
  }

  let approach, concerns
  for (let attempt = 1; attempt <= 2; attempt++) {
    const proposal = await agent(proposePrompt(n, concerns), { label: `propose #${n}${attempt > 1 ? ' (rework)' : ''}`, phase: 'Propose', schema: PROPOSAL })
    const candidates = proposal?.candidates || []
    approach = candidates[0]
    if (candidates.length > 1) {
      const debates = await parallel([
        ...candidates.map((_, i) => () => agent(debateCandidate(n, i, candidates), { label: `debate #${n} candidate${i + 1}`, phase: 'Propose', schema: DEBATE })),
        () => agent(antiOverengineeringPrompt(n, candidates), { label: `debate #${n} anti-overengineering`, phase: 'Propose', schema: ANTI_DEBATE }),
      ])
      const verdict = await agent(judgePrompt(n, candidates, debates), { label: `judge #${n}`, phase: 'Propose', schema: JUDGE })
      approach = verdict?.chosen || approach
      log(`#${n}: debated ${candidates.length} approaches: ${verdict?.reason || 'the judge failed, the first candidate is used'}`)
    }
    if (!approach) return { n, status: 'blocked', reason: 'no proposal produced' }

    const design = await agent(designReviewPrompt(n, approach), { label: `design-review #${n}`, phase: 'Design review', schema: DESIGN_REVIEW })
    if (!design) return { n, status: 'blocked', reason: 'the design reviewer failed' }
    if (design.verdict === 'sound') {
      approach = design.approved_approach || approach
      concerns = null
      break
    }
    concerns = design.concerns || []
  }
  if (concerns) return { n, status: 'blocked', reason: `the design review refused twice: ${concerns.join('; ')}` }

  const impl = await withLock(() => agent(implementPrompt(n, approach), { label: `implement #${n}`, phase: 'Implement', isolation: 'worktree', schema: IMPL }))
  if (impl?.status === 'needs_human_prerequisite')
    return { n, status: 'needs_human_prerequisite', branch: impl.branch, prerequisites: impl.prerequisites || [], reason: impl.blocked_reason }
  let pr = impl?.pr_number
  if (impl?.status === 'pr_opened' && !pr && impl.branch) {
    pr = (
      await agent(`Run \`gh pr list --repo ${REPO} --head ${impl.branch} --json number\` and return the first PR number (omit pr_number if none).`, {
        label: `find PR #${n}`,
        phase: 'Implement',
        effort: 'low',
        schema: { type: 'object', properties: { pr_number: { type: 'integer' } } },
      })
    )?.pr_number
  }
  if (impl?.status !== 'pr_opened' || !pr) {
    return { n, status: 'blocked', branch: impl?.branch, reason: impl ? impl.blocked_reason || 'no PR found for the branch' : 'the implementer failed' }
  }
  log(`#${n}: draft PR #${pr} opened on ${impl.branch}`)

  const lensKeys = ['spec', 'standards', ...(triage.risk_lens !== 'none' ? [triage.risk_lens] : [])]
  const history = []
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const reviews = (
      await parallel(
        lensKeys.map(key => () =>
          agent(reviewerPrompt(n, pr, LENSES[key].text(n)), { label: `review:${key} #${n} r${round}`, phase: 'Review', agentType: LENSES[key].agentType, schema: REVIEW }).then(
            r => r && { lens: key, ...r },
          ),
        ),
      )
    ).filter(Boolean)
    const gate = await withLock(() => agent(gatePrompt(n, pr, reviews, round), { label: `gatekeeper #${n} r${round}`, phase: 'Review', isolation: 'worktree', schema: GATE, effort: 'high' }))
    if (!gate) {
      history.push({ round, gate: 'the gatekeeper failed' })
      break
    }
    history.push({ round, verdict: gate.verdict, change_requests: gate.change_requests })

    if (gate.verdict === 'approve') {
      const merged = await withLock(() => agent(mergePrompt(n, pr, impl.branch, gate, impl), { label: `validate+merge #${n}`, phase: 'Merge', isolation: 'worktree', schema: MERGE }))
      if (merged?.status === 'merged_and_closed') {
        if (!merged.check_green || !merged.tests_green)
          return { n, pr, branch: impl.branch, status: 'needs_human', reason: `merged at ${merged.merge_sha} with a red pnpm check or pnpm test: read staging`, rounds: round }
        log(`#${n}: merged into staging and closed`)
        return { n, pr, branch: impl.branch, status: 'merged_and_closed', sha: merged.merge_sha, rounds: round }
      }
      const reason = merged ? merged.reason : 'the merge agent failed'
      if (round === MAX_ROUNDS) {
        history.push({ round, merge: reason })
        break
      }
      await withLock(() =>
        agent(fixPrompt(n, pr, impl.branch, { change_requests: [`The integration failed at merge time: ${reason}`], summary: 'Rebase onto origin/staging and fix the integration failure.' }), {
          label: `fix #${n} (integration)`,
          phase: 'Fix',
          isolation: 'worktree',
        }),
      )
      continue
    }
    if (round === MAX_ROUNDS) break
    await withLock(() => agent(fixPrompt(n, pr, impl.branch, gate), { label: `fix #${n} r${round}`, phase: 'Fix', isolation: 'worktree' }))
  }
  return { n, pr, branch: impl.branch, status: 'needs_human', reason: `no approved merge after ${MAX_ROUNDS} review rounds`, history }
}

for (const t of TICKETS) runTicket(t).then(r => settle[t.n](r), e => settle[t.n]({ n: t.n, status: 'error', reason: String(e) }))
const results = await Promise.all(TICKETS.map(t => finished[t.n]))

phase('Report')
await agent(
  `${HOUSE}
You REPORT on a resolve-ticket run. Do not change code. Never close an issue. Write every comment in
Simplified Technical English, with --body-file and a temporary file.
Results: ${JSON.stringify(results, null, 1)}
Skipped at preflight: ${JSON.stringify(preflight.skipped)}
1. For each flagged_* result: post ONE gh issue comment with the finding and its evidence (from
   reason; duplicate_of if set). The operator decides whether to close it.
2. For each needs_human, needs_human_prerequisite, blocked, skipped or error result: post ONE
   gh issue comment with the reason, the prerequisites as a "- [ ]" checklist, and the open change
   requests from history if present (also comment on the PR if pr is set). Then
   gh issue edit <n> --repo ${REPO} --add-label ready-for-human
3. ${
    args && args.reportIssue
      ? `Post ONE summary comment on issue #${args.reportIssue}: a table ticket | PR | status | rounds | reason or sha, then the tickets skipped at preflight and why, then what needs the operator, and the fact that nothing reached main (the operator promotes staging).`
      : 'Post no summary comment (no reportIssue was given).'
  }
4. Worktree cleanup: run git worktree list --porcelain (from any checkout; it lists every
   worktree). For each worktree whose path contains wf_, that is NOT locked, and whose branch is one
   of the merged branches of this run (${JSON.stringify(results.filter(r => r.status === 'merged_and_closed').map(r => r.branch))}), and is proven
   merged (git fetch origin, then git merge-base --is-ancestor <branch> origin/staging):
   git worktree remove <path>. Never force. Never remove a locked or unmerged worktree. Then
   git worktree prune.`,
  { label: 'report', phase: 'Report', effort: 'low' },
)

return { ran: results, skipped: preflight.skipped }
