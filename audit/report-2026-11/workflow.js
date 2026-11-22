export const meta = {
  name: 'report-audit',
  description: 'Audit every source of the GAB report and counter-check each claim with a panel, then adjudicate per chunk',
  phases: [
    { title: 'Audit and panel', detail: 'per chunk: 1 source auditor + journalist + sanctions lawyer + skeptic' },
    { title: 'Adjudicate', detail: 'per chunk: 1 judge re-checks each finding and drops weak ones' },
  ],
}

const FR = 'src/features/report/source/report-fr.md'
const EN = 'src/features/report/source/report-en.md'

const CHUNKS = [
  { key: 'A', title: 'Synthese, Introduction, Methode (1.1-1.3), Payer intro, 2.1 Les acheteurs', fr: '1-78', en: 'Summary to end of 2.1' },
  { key: 'B', title: '2.2 Le prix et le plafond, 2.3 Le budget', fr: '79-98', en: '2.2 and 2.3' },
  { key: 'C', title: '2.4 Les ports, 2.5 La flotte, 2.6 Les sanctions des navires', fr: '99-127', en: '2.4 to 2.6' },
  { key: 'D', title: 'Financer intro, 3.1 Le rouble et le yuan', fr: '128-139', en: '3 Finance intro and 3.1' },
  { key: 'E', title: '3.2 Les relais de paiement', fr: '140-155', en: '3.2' },
  { key: 'F', title: 'Combattre: 4.1, 4.2, 4.3', fr: '156-180', en: '4 Fight, 4.1 to 4.3' },
  { key: 'G', title: 'Qui possede quoi intro, 5.1, 5.2', fr: '181-196', en: '5 intro, 5.1, 5.2' },
  { key: 'H', title: '5.3 Les proches du president', fr: '197-208', en: '5.3' },
  { key: 'I', title: '5.4, 6 Limites, Conclusion, Annexe A', fr: '209-283', en: '5.4 to end of Annex A' },
]

const CONTEXT = (c) => `You work on the published report of the GAB project (repository in the current directory).
French text (primary, the author's final text): ${FR}. English twin: ${EN}. The note definitions are at the end of each file (lines that start with "[^id]:"); the map between French and English note ids is src/features/report/source/note-twins.ts. Figure data files: src/features/report/data/*.csv and *.json.
Your scope: chunk ${c.key} = "${c.title}" = French lines ${c.fr}, and the matching English part (${c.en}). Read all of the scope first, with each note it cites. Read other parts only to check consistency.
Notes with ids "n-..." and sentences that say "Calculs de l'auteur" are computations on the project database: you cannot reach the database (the gab MCP server is down). For those, check the stated method, the cited inputs, and the figure data files in the repository, and say what you could not check.
Do NOT edit any file. Do NOT use paid third-party tools (TinyFish, Firecrawl, Bright Data). Use WebSearch and WebFetch (load them with ToolSearch "select:WebSearch,WebFetch"), and curl through the proxy for PDF or XLSX files (save downloads in a new empty directory under the scratchpad or /tmp/claude-0, and read PDFs with the Read tool or pdftotext if present).
Report each problem as a finding. Give the exact sentence (quote, max 300 characters), the note id, verbatim evidence from the source with its URL and page or cell, and a minimal replacement in French AND in English that keeps the author's voice and changes only what the evidence requires. If the fix is to remove an overclaim, give the hedged sentence. If no fix is needed, do not report it. Never invent a source: a replacement source must be one that you fetched and read.`

const FINDING = {
  type: 'object',
  properties: {
    sentence_fr: { type: 'string' },
    note: { type: 'string' },
    category: { type: 'string', enum: ['number_mismatch', 'date_mismatch', 'unsupported_claim', 'overclaim_causal', 'misattribution', 'citation_details', 'dead_or_wrong_url', 'source_unreachable', 'legal_error', 'terminology_or_voice', 'missing_attribution', 'internal_inconsistency', 'fr_en_mismatch', 'figure_data_mismatch', 'other'] },
    severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
    problem: { type: 'string' },
    evidence: { type: 'string' },
    proposed_fr: { type: 'string' },
    proposed_en: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['sentence_fr', 'note', 'category', 'severity', 'problem', 'evidence', 'proposed_fr', 'proposed_en', 'confidence'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: FINDING },
    coverage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          note: { type: 'string' },
          status: { type: 'string', enum: ['supported', 'partly_supported', 'not_supported', 'unreachable', 'internal_calc_checked', 'internal_calc_unchecked', 'not_checked'] },
          comment: { type: 'string' },
        },
        required: ['note', 'status'],
      },
    },
    not_checked: { type: 'string' },
  },
  required: ['findings', 'coverage', 'not_checked'],
}

const AUDIT = (c) => `${CONTEXT(c)}

Your task: SOURCE AUDIT. For EVERY note marker in your scope (French and English), fetch the cited source and check that it supports the exact sentence that carries the marker: each number, unit, date, period, actor, and the direction of each claim. Check the citation details too: author, date, title, URL (does it resolve, is it the exact document), page or figure number. Check that the English twin says the same as the French text, with the same numbers. Fill "coverage" with one entry for each note in scope (no note left out). The issuer reliability letter (ADMIRALTY scale A to F) that the report describes: check that the text uses it in a consistent way with docs/decisions.md (rules S1 and S3) and report a mismatch.`

const LENSES = [
  {
    key: 'journalist', agentType: 'journalist',
    prompt: (c) => `${CONTEXT(c)}

Your task: COUNTER-EXPERTISE, lens of an investigative journalist and editor. Attack the chunk as a hostile reader or a lawyer for a named party would. Check: each claim about a named company, person or state is attributed to its source in the text; a party to the conflict (for example GUR, Ukrainian or Russian state bodies) is named as such; hypotheses are marked as hypotheses; causal words (because, explains, effect, so) go no further than the cited evidence; no loaded words ("shadow fleet", "evader") in GAB's own voice unless an issuer uses them and the text says so; defamation risk for named persons; whether each claim is current at the report date (the record is dated 27 October 2026; check for later events that change a claim, for example a delisting or a correction). Fetch the cited source when you challenge a claim. Fill "coverage" with the notes you examined.`,
  },
  {
    key: 'lawyer', agentType: 'sanctions-lawyer',
    prompt: (c) => `${CONTEXT(c)}

Your task: COUNTER-EXPERTISE, lens of a sanctions lawyer. Check each legal statement against the official text: regulation numbers and CELEX ids, article and annex numbers, dates of adoption and of entry into force, what a measure prohibits and to whom it applies (EU operators, US persons, UK persons), the price cap mechanics, OFAC programme and designation dates and authorities (executive orders, 50 percent rule wording for OFAC versus EU ownership and control), UK designations, SWIFT removals, the status of listed persons and entities (still listed, delisted, annulled by the General Court?). Fetch the official text (eur-lex.europa.eu, ofac.treasury.gov, home.treasury.gov, gov.uk). Fill "coverage" with the notes you examined.`,
  },
  {
    key: 'skeptic', agentType: 'skeptic',
    prompt: (c) => `${CONTEXT(c)}

Your task: COUNTER-EXPERTISE, devil's advocate and quantitative check. Find the weakest fact of each paragraph. Recompute each derived figure (ratios such as "2.6 times", percentages, "twenty times", "nearly nine in ten", shares, constant-price conversions) from the cited sources or the figure data files in src/features/report/data, and say if the result differs. Check internal consistency: the same figure must have the same value in the summary, the body, the figure captions, the conclusion and the English text. Check that each "Selon l'hypothese du rapport" is not presented elsewhere as a fact, and that correlations are not presented as causes. Check the period and base year of each comparison. Fill "coverage" with the notes you examined.`,
  },
]

const VERDICTS = {
  type: 'object',
  properties: {
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sentence_fr: { type: 'string' },
          note: { type: 'string' },
          category: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          proposed_fr: { type: 'string' },
          proposed_en: { type: 'string' },
          raised_by: { type: 'array', items: { type: 'string' } },
          judge_check: { type: 'string' },
        },
        required: ['sentence_fr', 'note', 'category', 'severity', 'problem', 'evidence', 'proposed_fr', 'proposed_en', 'raised_by', 'judge_check'],
      },
    },
    rejected: {
      type: 'array',
      items: {
        type: 'object',
        properties: { summary: { type: 'string' }, raised_by: { type: 'string' }, reason: { type: 'string' } },
        required: ['summary', 'raised_by', 'reason'],
      },
    },
    open_questions: { type: 'array', items: { type: 'string' } },
    chunk_verdict: { type: 'string' },
  },
  required: ['confirmed', 'rejected', 'open_questions', 'chunk_verdict'],
}

const JUDGE = (c, results) => `${CONTEXT(c)}

Your task: ADJUDICATE. Four independent reviewers (a source auditor, a journalist, a sanctions lawyer, a skeptic) examined this chunk. Their raw findings are below as JSON. For each finding:
1. Merge duplicates (same sentence, same problem) into one item and list all reviewers in raised_by.
2. Try to REFUTE it: open the cited source yourself and read the relevant passage. A finding survives only if you confirm it with the source text. If you cannot reach the source, keep it only if the evidence quoted by the reviewer is specific and verifiable, and say so in judge_check.
3. Reject findings that are matters of style or taste, that ask for more than the evidence requires, or that misread the text. Record each rejection with a short reason.
4. For each confirmed item, write the final minimal replacement in French and in English. Keep the author's voice and sentence shape. Keep the note markers in place. Do not add numbers or months that no source gives.
Put questions that only the author can answer (for example a computation on the database that no one could check) in open_questions. Give a one-paragraph chunk_verdict.

RAW FINDINGS:
${JSON.stringify(results)}`

const results = await pipeline(
  CHUNKS,
  (c) => parallel([
    () => agent(AUDIT(c), { label: `audit:${c.key}`, phase: 'Audit and panel', schema: FINDINGS, agentType: 'general-purpose', effort: 'high' })
      .then((r) => r && { reviewer: 'source-auditor', ...r }),
    ...LENSES.map((l) => () => agent(l.prompt(c), { label: `${l.key}:${c.key}`, phase: 'Audit and panel', schema: FINDINGS, agentType: l.agentType, effort: 'high' })
      .then((r) => r && { reviewer: l.key, ...r })),
  ]),
  (reviews, c) => {
    const ok = reviews.filter(Boolean)
    log(`Chunk ${c.key}: ${ok.length}/4 reviewers returned, ${ok.reduce((n, r) => n + r.findings.length, 0)} raw findings`)
    const raw = ok.map((r) => ({ reviewer: r.reviewer, findings: r.findings, not_checked: r.not_checked }))
    return agent(JUDGE(c, raw), { label: `judge:${c.key}`, phase: 'Adjudicate', schema: VERDICTS, agentType: 'general-purpose', effort: 'high' })
      .then((v) => ({ chunk: c.key, title: c.title, verdict: v, coverage: ok.find((r) => r.reviewer === 'source-auditor')?.coverage ?? null, reviewers: ok.map((r) => r.reviewer), raw }))
  },
)

return results.filter(Boolean)
