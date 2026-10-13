export const meta = {
  name: 'review-queue',
  description: 'Decide each doubt of the review queue as an AI reviewer, until no doubt waits',
  whenToUse: 'The operator asks to empty the review queue of Gabriel. Start the session in research/, with the gab server connected.',
  phases: [
    { title: 'Inventory', detail: 'list each doubt', model: 'sonnet' },
    { title: 'Review', detail: 'one agent per batch of units', model: 'sonnet' },
    { title: 'Report', detail: 'counts and open points' },
  ],
}

// args (optional): { batch: 15, rounds: 3 }
// Only the doubts: a waiting unit waits for a source, and no reviewer decides it (S3).
const BATCH = (args && args.batch) || 15
const ROUNDS = (args && args.rounds) || 3

const INVENTORY = {
  type: 'object',
  properties: {
    counts: { type: 'object', properties: { doubt: { type: 'integer' }, waiting: { type: 'integer' }, decided: { type: 'integer' } } },
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          unit: { type: 'string' },
          lane: { type: 'string' },
          group: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['unit', 'lane'],
      },
    },
  },
  required: ['units'],
}

const DECISIONS = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          unit: { type: 'string' },
          outcome: { type: 'string', enum: ['promoted', 'rejected', 'relation_rejected_then_promoted', 'relation_rejected_then_rejected', 'refused', 'already_decided', 'left', 'unsure', 'error'] },
          reason: { type: 'string', description: 'reject reason code, or the refusal text, in a few words' },
        },
        required: ['unit', 'outcome'],
      },
    },
  },
  required: ['decisions'],
}

const inventoryPrompt = `You are the inventory step of a review of the Gabriel review queue. You decide nothing and you propose nothing.

1. Load the gab tool with ToolSearch ("select:mcp__gab__read_doubts").
2. Read each page of read_doubts, with size 50, and give "next" as "after" until a page has no "next".
3. A page is large. When the tool saves the result to a file, extract the fields with Python: run "python -I -c ..." and call sys.stdout.reconfigure(encoding='utf-8') first. Each unit has the fields "unit", "lane", "group" (take group.id) and "name".
4. Return each unit once (unit ids are unique), and the counts of the last page.`

const RULES = `You are an AI reviewer of the Gabriel review queue. Follow the skill review-unit (research/.claude/skills/review-unit/SKILL.md): read it first. These rules apply to this run:

- Never call propose, enqueue_extract, enqueue_mapping or start_lead. This run decides; it adds nothing.
- Load the tools with ToolSearch: "select:mcp__gab__read_unit,mcp__gab__document_text,mcp__gab__read_entity,mcp__gab__list_proposals,mcp__gab__promote_unit,mcp__gab__reject_unit,mcp__gab__reject_relation".
- Do one unit at a time, in the order of the list. For each unit:
  1. Call read_unit. When it says that the unit is decided or absent, write "already_decided" and go on.
  2. Read each cited passage with the words around it, then the faults, the dispute reasons and the check of the second model. When a passage is short or unclear, read the page with document_text.
  3. Compare each act with its passage: the name, the type, each value, each date and each end of each relation. A value that the passage does not state is not supported. A registry link, a URL or a logo is not a statement.
  4. Before you promote a relation, check for a duplicate: read_entity on its source, and list_proposals on its source entity. The same type to the same other end is a duplicate. When two pending acts are the same relation, keep the act with the earliest createdAt and reject the other one with "duplicate". Other reviewers apply the same rule, so the result is the same in each batch.
  5. Decide:
     - Each act is stated by its passages and no fault blocks the unit: promote_unit.
     - Only one relation is wrong: reject_relation with the id of its act, then decide the rest of the unit with the same rules.
     - The unit is wrong as a whole, or its main entity is not supported: reject_unit.
     - You are not sure that the passages state each act: decide nothing, and write "unsure" with the question in "reason". The lead session sends it to the expert panel. Never promote a unit to make the queue shorter.
     - A designated_by relation for a sectoral measure, or a unit that a spec or a ticket holds in the queue (skill review-unit): decide nothing, and write "left" with the reason.
     - A relation whose other end was rejected: reject it with "end_rejected".
     - The record refuses a promotion (a unit that waits for another unit, an impossible link): write "refused" with the refusal text. {FINAL}
  6. Give "why" for each decision in French: one or two sentences that name the document id, the page and how the passage supports the decision. Do not copy a value of the passage into "why" as a new fact.
- Reject reasons: wrong_value, not_in_source, wrong_type, duplicate, out_of_scope, end_rejected, other (needs a note). Notes are in French.
- Do not stop before the end of the list. Return one line per unit.`

const FINAL_NORMAL = 'Leave a refused unit: a later round tries it again.'
const FINAL_LAST = 'This is the last round. A unit that the record refuses to promote gets reject_unit with reason "other" and a French note that gives the refusal.'

function batchesOf(units) {
  // Keep a group in one batch when it can, so a duplicate inside a group meets one reviewer.
  const sorted = [...units].sort((a, b) => (a.group || a.unit).localeCompare(b.group || b.unit))
  const out = []
  for (let i = 0; i < sorted.length; i += BATCH) out.push(sorted.slice(i, i + BATCH))
  return out
}

const tally = {}
const refusedLast = []
const forLead = new Map()
let before = null

for (let round = 1; round <= ROUNDS; round++) {
  phase('Inventory')
  const inv = await agent(inventoryPrompt, { label: `inventory:round-${round}`, phase: 'Inventory', schema: INVENTORY, model: 'sonnet', effort: 'low' })
  if (!inv) { log(`Round ${round}: the inventory failed. Stop.`); break }
  const units = inv.units
  log(`Round ${round}: ${units.length} units wait (${JSON.stringify(inv.counts || {})}).`)
  if (!units.length) break
  if (before !== null && units.length >= before) {
    log(`Round ${round}: no progress since the round before. Stop.`)
    break
  }
  before = units.length

  const last = round === ROUNDS
  const rules = RULES.replace('{FINAL}', last ? FINAL_LAST : FINAL_NORMAL)
  phase('Review')
  const results = await pipeline(
    batchesOf(units),
    (batch, _b, i) => agent(
      `${rules}\n\nThe units of this batch (round ${round}, batch ${i + 1}):\n${batch.map(u => `- ${u.unit} (${u.lane}) ${u.name || ''}`).join('\n')}`,
      { label: `review:r${round}-b${i + 1}`, phase: 'Review', schema: DECISIONS, model: 'sonnet', effort: 'medium' },
    ),
  )
  for (const r of results.filter(Boolean)) {
    for (const d of r.decisions) {
      tally[d.outcome] = (tally[d.outcome] || 0) + 1
      if (last && (d.outcome === 'refused' || d.outcome === 'error')) refusedLast.push(d)
      if (d.outcome === 'unsure' || d.outcome === 'left') forLead.set(d.unit, d)
    }
  }
  const lost = results.filter(r => !r).length
  if (lost) log(`Round ${round}: ${lost} batches gave no result; the next round reads their units again.`)
  log(`Round ${round}: ${JSON.stringify(tally)}`)
}

phase('Report')
const final = await agent(inventoryPrompt, { label: 'inventory:final', phase: 'Report', schema: INVENTORY, model: 'sonnet', effort: 'low' })
return {
  outcomes: tally,
  still_waiting: final ? final.units.length : 'unknown',
  still_waiting_units: final ? final.units.slice(0, 50) : [],
  refused_in_last_round: refusedLast,
  // The lead session runs the skill expert-panel on each "unsure" unit, and decides it.
  for_the_lead_session: [...forLead.values()],
}
