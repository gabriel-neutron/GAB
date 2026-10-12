export const meta = {
  name: 'research-sprint',
  description: 'Run one research sprint: a coordinator, one worker for each lot of lots.json, then a synthesis and the prompt of the review session',
  whenToUse: 'The operator asks to run a research sprint that has a SPEC.md and a lots.json. Start the session in research/, with the gab server connected.',
  phases: [
    { title: 'Coordinate', detail: 'the coordinator part of SPEC.md, and the list of lots' },
    { title: 'Work', detail: 'one worker for each worker id of lots.json' },
    { title: 'Synthesize', detail: 'RAPPORT.md, ticket, review prompt' },
  ],
}

// args: { dir: 'research/out/sprint/<flux>', ticket: 483, minutes: 80 }
if (!args || !args.dir) throw new Error('args.dir names the folder of the sprint (SPEC.md and lots.json)')
const DIR = args.dir
const TICKET = args.ticket ? `#${args.ticket}` : 'the ticket that SPEC.md names'
const MINUTES = args.minutes || 80

const LOTS = {
  type: 'object',
  properties: {
    vocabulary: { type: 'string', description: 'the types and keys of list_vocabulary, short' },
    workers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { worker: { type: 'string' }, lots: { type: 'array', items: { type: 'string' } } },
        required: ['worker', 'lots'],
      },
    },
  },
  required: ['workers'],
}

const RESULT = {
  type: 'object',
  properties: {
    worker: { type: 'string' },
    proposals: { type: 'array', items: { type: 'string' }, description: 'the proposal ids' },
    documents: { type: 'array', items: { type: 'string' }, description: 'the new document ids' },
    needs: { type: 'array', items: { type: 'string' }, description: 'one line of needs.md for each blocked source' },
    open: { type: 'array', items: { type: 'string' }, description: 'what stays open, with its reason' },
    lots: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, status: { type: 'string', enum: ['done', 'blocked', 'partial'] } },
        required: ['id', 'status'],
      },
    },
    status: { type: 'string', enum: ['done', 'blocked', 'partial'] },
  },
  required: ['worker', 'proposals', 'status', 'lots'],
}

phase('Coordinate')
const plan = await agent(
  `You are the coordinator of the research sprint in ${DIR} (${TICKET}). You propose nothing and you decide nothing.

1. Read ${DIR}/SPEC.md and ${DIR}/lots.json, and research/out/sprint/README.md when it exists (the rules of ownership).
2. Do the coordinator part of the contract of SPEC.md, when it has one.
3. Call list_vocabulary once, and give a short form of it.
4. Return each worker id of lots.json with its lot ids, in the order of lots.json. A lot with the status "done" stays out.`,
  { label: 'coordinator', phase: 'Coordinate', schema: LOTS },
)
if (!plan || !plan.workers.length) return { status: 'no lot to do' }
log(`${plan.workers.length} workers: ${plan.workers.map(w => w.worker).join(', ')}`)

const workerPrompt = w => `You are the worker ${w.worker} of the research sprint in ${DIR} (${TICKET}). Your lots: ${w.lots.join(', ')}.

- Read ${DIR}/SPEC.md (your contract) and your lots in ${DIR}/lots.json. Read the skills research-method, cite-claim and source-hunt (research/.claude/skills). Stay on the items of your lots.
- Vocabulary of the record: ${plan.vocabulary || 'call list_vocabulary once'}.
- You have no browser: a source that needs the browser is a line of needs.
- A question of method, source or data model: decide it with the rules of SPEC.md and research-method. When they do not answer it, write it in "open" and continue with the next item.
- Time box: ${MINUTES} minutes. Write your log to ${DIR}/<lot>.md, and return the status of each of your lots.
- Never decide a unit. Never write lots.json, needs.md, besoins.md or a file of another worker.`

phase('Work')
const results = await pipeline(plan.workers, w =>
  agent(workerPrompt(w), { label: `worker:${w.worker}`, phase: 'Work', schema: RESULT }),
)
const done = results.filter(Boolean)
const lost = plan.workers.filter((_, i) => !results[i]).map(w => w.worker)
if (lost.length) log(`No result from: ${lost.join(', ')}. The synthesis marks their lots open.`)

phase('Synthesize')
const report = await agent(
  `You close the research sprint in ${DIR} (${TICKET}). The results of the workers:
${JSON.stringify(done)}
Workers with no result: ${lost.join(', ') || 'none'}.

1. Set the status of each lot in ${DIR}/lots.json from the results (a lot with no result is "blocked").
2. Write ${DIR}/RAPPORT.md in French: counts, proposal ids, documents, what stays open.
3. Add the lines of needs once to research/out/needs.md, after a fresh read of the file (no duplicate).
4. Close the step with the skill carto-step: tick the true boxes of ${TICKET}, and post the comment (ASD-STE100, no local path). The operator started this workflow, and that is the request to post.
5. Write in RAPPORT.md the prompt of a separate review session (skill review-unit) on the proposal ids of the sprint.
Return the path of RAPPORT.md and the prompt of the review session.`,
  { label: 'synthesis', phase: 'Synthesize' },
)
// The lead session runs the skill expert-panel on each open question: a workflow agent cannot start a panel.
return { workers: done.length, lost, open: done.flatMap(r => (r.open || []).map(q => `${r.worker}: ${q}`)), report }
