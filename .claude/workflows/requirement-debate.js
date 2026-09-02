export const meta = {
  name: 'requirement-debate',
  description:
    'Debate each open requirement, agree one decision, cut every part nobody asked for, and ask the operator only where a technical expert cannot decide',
  whenToUse:
    'An open question blocks the build, and you want a decision with its reason and its cost. Pass the subjects as args: a ticket number, a ticket slug, or a question in one sentence.',
  phases: [
    { title: 'Choose', detail: 'one agent reads the tracker and names the questions that block the build' },
    { title: 'Ground', detail: 'one agent states the question and the rules that bind it' },
    { title: 'Debate', detail: 'three lenses answer: the smallest build, the invariants, the one operator' },
    { title: 'Agree', detail: 'one agent merges the three into one decision' },
    { title: 'Cut', detail: 'the guard attacks the decision and removes each part nobody asked for' },
    { title: 'Settle', detail: 'one agent applies the cuts and writes the decision' },
    { title: 'Audit', detail: 'one agent reads every decision together and finds each contradiction' },
  ],
}

// Two subjects per run. Each subject costs six or seven agents, and a run that debates every
// open question at once gives the operator more to read than one sitting holds.
const MAX_SUBJECTS = 2

const HOUSE = `
You debate one requirement of the GAB project. You write no file. You change no code.
You never write to the tracker. The operator owns docs/, and a hook refuses a write there.

Read docs/README.md first. It routes you to the document that governs the question.
Read docs/spec.md always: it holds the invariants, the read path and the write path.
Read docs/decisions.md for a named entry such as M8, P1, P6, S3, T3, T4 or T5. That register is
locked: a new decision replaces an entry by name, and no entry is deleted.
Read an ADR under docs/adr/ when the question touches the runtime, the schema, the frontend,
the map, or a comment. Read the SQL under db/ for the authority on a constraint, never a document.
Read the tracker for the rulings of the operator: gh issue list --state open --limit 60 and
gh issue view <number> --comments. Read only. Write nothing there.

The facts of this project. One operator. Windows. Docker Desktop. A local stack of PostgreSQL
with PostGIS and pgvector, MinIO and PostgREST, on the loopback address alone. TypeScript on
both sides. Roughly one hundred documents. No team. No on-call. No paying user. No deployment.
`

const ESCALATION = `
The operator is asked only where a technical expert cannot decide. One of these five is true:
1. The answer changes what the product does, or what it refuses to do.
2. The answer is a judgement of risk, of law, of ethics, or of who is trusted.
3. The answer spends money, or it starts a subscription.
4. The answer is costly to reverse.
5. The experts split, and no fact in the repository breaks the tie.
Where none of the five is true, you decide. Do not send a question up because it feels large.
A decision names three things: its reason, its cost, and the fact that proves it wrong.
`

const LENSES = [
  {
    key: 'smallest',
    title: 'the smallest build',
    brief: `
Argue for the least work that answers the question today. Prefer the option that adds no service,
no dependency, no table and no file. Prefer a thing already installed over a thing to install.
Name the version of your answer that a person builds in one sitting. Where the question needs
nothing built at all, say so: that is a valid answer, and it is often the correct one.`,
  },
  {
    key: 'invariants',
    title: 'the invariants',
    brief: `
Argue for what keeps the guarantees of this project true. Read the six invariants of docs/spec.md
and the privilege boundary they name. Read the SQL that holds them. Say which invariant the
question touches, and what an answer must do to keep it true. You may demand work. Where a cheap
answer breaks a guarantee, say which guarantee, and say what the breach costs on a real corpus.`,
  },
  {
    key: 'operator',
    title: 'the one operator',
    brief: `
Argue from the person who runs this. One operator, on Windows, with Docker Desktop and no team.
Weigh what the answer costs to carry for a year: a second service to start, a second secret to
keep, a step to remember, a thing that breaks on a Monday. A part that a person must remember is
more expensive than a part a check enforces. Say what the answer costs on the day it goes wrong.`,
  },
]

const GUARD = `
You are the guard against over-engineering and against generated filler. Your bias is to delete.
You add nothing. You propose no new part. You cut, or you endorse.

Cut each of these on sight:
- a part that answers a question nobody asked
- an abstraction with one caller
- a configuration value that holds one value
- a mode, a flag or an option that nobody requested
- a retry, a cache, a pool or an index that nobody measured
- a table, a column, a file or a layer that nothing reads
- work for a deployment, a team or a scale that does not exist
- a second way to do a thing that one way already does
- a rule in code that repeats a rule the database already holds

Cut generated filler in the writing too:
- a sentence that restates the question
- a hedge that carries no fact
- three options where two are decoration
- a name that says less than the thing it names

Two rules of this project are yours to enforce.
No code anticipates a decision that is not made.
An operational parameter is calibrated on real data, and it is never a code constant.

Test each part of the decision with one question: delete it, and what breaks?
Where nothing breaks, cut it. Where you cannot name what breaks, cut it.
`

const CHOSEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subjects'],
  properties: {
    subjects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['subject', 'why'],
        properties: {
          subject: { type: 'string', description: 'the ticket and the question in one sentence' },
          why: { type: 'string', description: 'the work this question blocks today' },
        },
      },
    },
  },
}

const GROUND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['question', 'binds', 'options', 'settledAlready', 'settledAnswer'],
  properties: {
    question: { type: 'string', description: 'the question in one sentence' },
    binds: {
      type: 'array',
      description: 'each rule, invariant, register entry or built thing that bounds the answer',
      items: { type: 'string' },
    },
    options: {
      type: 'array',
      description: 'each answer the repository or the tracker already puts on the table',
      items: { type: 'string' },
    },
    settledAlready: {
      type: 'boolean',
      description: 'true where a document, the SQL or a ruling of the operator already answers it',
    },
    settledAnswer: { type: 'string', description: 'the existing answer, or an empty string' },
  },
}

const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'reason', 'cost', 'smallestVersion', 'operatorNeeded', 'operatorWhy'],
  properties: {
    answer: { type: 'string', description: 'the answer this lens argues for, in one sentence' },
    reason: { type: 'string' },
    cost: { type: 'string', description: 'what this answer gives up' },
    smallestVersion: { type: 'string', description: 'the least that satisfies this lens' },
    operatorNeeded: { type: 'boolean' },
    operatorWhy: { type: 'string', description: 'which of the five tests is true, or empty' },
  },
}

const AGREED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'decision',
    'reason',
    'cost',
    'provesItWrong',
    'agreement',
    'splitOn',
    'verdict',
    'buildNow',
    'refused',
  ],
  properties: {
    decision: { type: 'string' },
    reason: { type: 'string' },
    cost: { type: 'string' },
    provesItWrong: { type: 'string', description: 'the fact that would reverse this decision' },
    agreement: { type: 'string', enum: ['agreed', 'split'] },
    splitOn: { type: 'string', description: 'what the lenses could not settle, or empty' },
    verdict: { type: 'string', enum: ['decided', 'ask-operator'] },
    buildNow: { type: 'array', items: { type: 'string' }, description: 'the smallest list of work' },
    refused: { type: 'array', items: { type: 'string' }, description: 'each proposal refused, and why' },
  },
}

const CUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['endorsed', 'cuts', 'simplerAnswer', 'filler', 'override'],
  properties: {
    endorsed: { type: 'boolean', description: 'true where nothing is cut' },
    cuts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['part', 'why'],
        properties: { part: { type: 'string' }, why: { type: 'string' } },
      },
    },
    simplerAnswer: { type: 'string', description: 'a smaller answer that holds, or empty' },
    filler: { type: 'array', items: { type: 'string' }, description: 'each empty sentence found' },
    override: {
      type: 'string',
      enum: ['none', 'ask-operator', 'decided'],
      description: 'change the verdict only where one of the five tests decides it',
    },
  },
}

const FINAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'decision',
    'reason',
    'cost',
    'provesItWrong',
    'verdict',
    'buildNow',
    'refused',
    'choice',
    'options',
    'recommend',
    'ifWrong',
  ],
  properties: {
    decision: { type: 'string' },
    reason: { type: 'string' },
    cost: { type: 'string' },
    provesItWrong: { type: 'string' },
    verdict: { type: 'string', enum: ['decided', 'ask-operator'] },
    buildNow: { type: 'array', items: { type: 'string' } },
    refused: { type: 'array', items: { type: 'string' } },
    choice: { type: 'string', description: 'the question for the operator, or empty' },
    options: { type: 'array', items: { type: 'string' } },
    recommend: { type: 'string' },
    ifWrong: { type: 'string' },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['contradictions', 'missed'],
  properties: {
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['between', 'problem', 'fix'],
        properties: { between: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } },
      },
    },
    missed: { type: 'array', items: { type: 'string' }, description: 'each question these answers open' },
  },
}

const short = (text) => (text.length > 44 ? text.slice(0, 41) + '...' : text)

const asSubjects = (given) => {
  if (typeof given === 'string' && given.trim() !== '')
    return [{ subject: given, why: 'named by the operator' }]
  if (Array.isArray(given))
    return given
      .filter(Boolean)
      .map((one) => (typeof one === 'string' ? { subject: one, why: 'named by the operator' } : one))
  return null
}

// A settled question leaves the pipeline at once. A debate about a question the documents
// already answer is the first thing the guard would cut.
const settledFrom = (ground, subject) => ({
  subject: subject.subject,
  decision: ground.settledAnswer,
  reason: 'The repository already answers this. Nothing was debated.',
  cost: 'none',
  provesItWrong: 'the document or the SQL that holds this answer changes',
  verdict: 'decided',
  buildNow: [],
  refused: [],
  choice: '',
  options: [],
  recommend: '',
  ifWrong: '',
  settledAlready: true,
})

const endorsedFrom = (state, subject) => ({
  subject: subject.subject,
  decision: state.agreed.decision,
  reason: state.agreed.reason,
  cost: state.agreed.cost,
  provesItWrong: state.agreed.provesItWrong,
  verdict: state.agreed.verdict,
  buildNow: state.agreed.buildNow,
  refused: state.agreed.refused,
  choice: state.agreed.verdict === 'ask-operator' ? state.agreed.splitOn : '',
  options: [],
  recommend: '',
  ifWrong: '',
  settledAlready: false,
})

phase('Choose')
let subjects = asSubjects(args)

if (subjects === null) {
  const chosen = await agent(
    HOUSE +
      '\n\nRead the tracker and the repository. Name the ' +
      MAX_SUBJECTS +
      ` open questions that block the build today. A question blocks the build where a person
cannot write the next file until it is answered. Prefer a question that a document already names
as unsettled. Return the ticket and the question in one sentence.`,
    { label: 'choose the blocking questions', phase: 'Choose', schema: CHOSEN_SCHEMA },
  )
  subjects = chosen === null ? [] : chosen.subjects
}

if (subjects.length === 0) return { decided: [], ask: [], audit: null, note: 'no subject was found' }

if (subjects.length > MAX_SUBJECTS) {
  const dropped = subjects.slice(MAX_SUBJECTS).map((one) => short(one.subject)).join('; ')
  log(
    subjects.length +
      ' subjects given. This run debates the first ' +
      MAX_SUBJECTS +
      '. These are not covered: ' +
      dropped,
  )
  subjects = subjects.slice(0, MAX_SUBJECTS)
}

log('Debating ' + subjects.length + ': ' + subjects.map((one) => short(one.subject)).join(' | '))

const results = await pipeline(
  subjects,

  (subject) =>
    agent(
      HOUSE +
        `
The subject: ` +
        subject.subject +
        `
It blocks: ` +
        subject.why +
        `

State the question in one sentence. List each rule that bounds the answer: an invariant, an entry
of the locked register, an ADR, a constraint in the SQL, a thing already built. List each answer
the repository or the tracker already puts on the table. Take no side.

Then answer one thing plainly: does a document, the SQL, or a ruling in the tracker already settle
this? Where it does, say so and give that answer. Do not open a question that is already closed.`,
      { label: 'ground: ' + short(subject.subject), phase: 'Ground', schema: GROUND_SCHEMA },
    ),

  (ground, subject) => {
    if (ground === null) return null
    if (ground.settledAlready) return { settled: settledFrom(ground, subject) }
    return parallel(
      LENSES.map(
        (lens) => () =>
          agent(
            HOUSE +
              ESCALATION +
              `
You argue one side of a debate. Your lens is ` +
              lens.title +
              '.' +
              lens.brief +
              `

The question: ` +
              ground.question +
              `
It is bound by:
` +
              ground.binds.map((one) => '- ' + one).join('\n') +
              `
The answers already on the table:
` +
              ground.options.map((one) => '- ' + one).join('\n') +
              `

Read the repository yourself. Do not trust the list above where the code says otherwise.
Give the answer your lens argues for, its reason, and what it gives up. Then give the smallest
version of it. Say whether the operator must decide this, and which of the five tests is true.`,
            {
              label: lens.key + ': ' + short(ground.question),
              phase: 'Debate',
              schema: ANSWER_SCHEMA,
            },
          ),
      ),
    ).then((answers) => ({ ground, answers: answers.filter(Boolean) }))
  },

  (state) => {
    if (state === null || state.settled) return state
    const table = state.answers
      .map(
        (one, index) =>
          '--- ' +
          (LENSES[index] ? LENSES[index].title : 'a lens') +
          ' ---\nanswer: ' +
          one.answer +
          '\nreason: ' +
          one.reason +
          '\ncost: ' +
          one.cost +
          '\nsmallest: ' +
          one.smallestVersion +
          '\noperator needed: ' +
          one.operatorNeeded +
          ' ' +
          one.operatorWhy,
      )
      .join('\n\n')
    return agent(
      HOUSE +
        ESCALATION +
        `
Three experts answered one question. Your work is to agree one decision, and not to report three.

The question: ` +
        state.ground.question +
        `

` +
        table +
        `

Where the three agree, say the decision once. Where two agree and one does not, read the repository
and break the tie on a fact, and never on a vote. Where the split is real and no fact breaks it,
the verdict is ask-operator, and you name exactly what they split on.

Name the work to do now, as the shortest list that answers the question. Name each proposal you
refused, and why. Give the fact that would prove the decision wrong.`,
      { label: 'agree: ' + short(state.ground.question), phase: 'Agree', schema: AGREED_SCHEMA },
    ).then((agreed) => (agreed === null ? null : { ...state, agreed }))
  },

  (state) => {
    if (state === null || state.settled) return state
    return agent(
      HOUSE +
        GUARD +
        `
Attack this decision. Three experts agreed on it, and agreement grows parts.

The question: ` +
        state.ground.question +
        `
The decision: ` +
        state.agreed.decision +
        `
The reason: ` +
        state.agreed.reason +
        `
The cost: ` +
        state.agreed.cost +
        `
The work proposed:
` +
        state.agreed.buildNow.map((one) => '- ' + one).join('\n') +
        `

Read the repository. For each part of the work, ask: delete it, and what breaks? Cut every part
where you cannot name what breaks. Cut every sentence that carries no fact.

Where a smaller answer holds the same guarantees, give it. Where nothing is to cut, endorse it and
say so plainly. Do not invent a cut to look useful; an endorsement is a real result.

You may change the verdict on a test, and never on a feeling. Send it to the operator only where
one of the five tests below is true. Pull it back from the operator where none is true.` +
        ESCALATION,
      { label: 'cut: ' + short(state.ground.question), phase: 'Cut', schema: CUT_SCHEMA },
    ).then((cut) => (cut === null ? null : { ...state, cut }))
  },

  (state, subject) => {
    if (state === null) return null
    if (state.settled) return state.settled
    // The guard endorsed and changed no verdict, so the decision stands as agreed. No agent runs.
    if (state.cut.endorsed && state.cut.override === 'none') return endorsedFrom(state, subject)
    return agent(
      HOUSE +
        ESCALATION +
        `
Write the final decision. The experts agreed, and then the guard cut.

The question: ` +
        state.ground.question +
        `
The agreed decision: ` +
        state.agreed.decision +
        `
The agreed reason: ` +
        state.agreed.reason +
        `
The agreed cost: ` +
        state.agreed.cost +
        `
The agreed work:
` +
        state.agreed.buildNow.map((one) => '- ' + one).join('\n') +
        `
The agreed verdict: ` +
        state.agreed.verdict +
        `

The guard cut:
` +
        state.cut.cuts.map((one) => '- ' + one.part + ': ' + one.why).join('\n') +
        `
A smaller answer: ` +
        (state.cut.simplerAnswer || 'none given') +
        `
Filler found: ` +
        (state.cut.filler.join('; ') || 'none') +
        `
Verdict change: ` +
        state.cut.override +
        `

Apply each cut. Keep the smaller answer where it holds every guarantee the question is bound by;
where it does not, keep the larger answer and say which guarantee that saves. The guard removes
work, so your list is shorter than the list above, or the same length. It is never longer.

Where the verdict is ask-operator, write the question for the operator in four parts and no more:
the choice, the options, the one you recommend, and what it costs if the recommendation is wrong.
Where the verdict is decided, leave those four empty.`,
      { label: 'settle: ' + short(state.ground.question), phase: 'Settle', schema: FINAL_SCHEMA },
    ).then((final) =>
      final === null ? null : { ...final, subject: subject.subject, settledAlready: false },
    )
  },
)

const finals = results.filter(Boolean)
const decided = finals.filter((one) => one.verdict === 'decided')
const ask = finals.filter((one) => one.verdict === 'ask-operator')

if (finals.length < 2) return { decided, ask, audit: null }

phase('Audit')
const audit = await agent(
  HOUSE +
    `
Read these decisions together. One decision at a time is easy to keep consistent with the rules,
and hard to keep consistent with the other decisions.

` +
    finals
      .map(
        (one) =>
          '--- ' +
          one.subject +
          ' ---\nverdict: ' +
          one.verdict +
          '\ndecision: ' +
          one.decision +
          '\nwork: ' +
          (one.buildNow.join('; ') || 'none'),
      )
      .join('\n\n') +
    `

Name each contradiction: two decisions that cannot both hold, or one that breaks an entry of the
locked register, an invariant, or an ADR. Give the fix for each. Then name each new question these
answers open, which nothing on the tracker holds today. Where there is no contradiction, say so
with an empty list, and do not invent one.`,
  { label: 'audit the decisions together', phase: 'Audit', schema: AUDIT_SCHEMA },
)

return { decided, ask, audit }
