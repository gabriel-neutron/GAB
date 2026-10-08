import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import {
  openBudget,
  openModel,
  openrouterModel,
  PROVIDER,
  readModelConfig,
  readTokenCap,
  type CallRecord,
  type Message,
  type ModelConfig,
} from '@gab/model';
import { checkAnswer, verdictsOf } from '@gab/tools/check-answer';
import { CheckFailure, type CheckVerdict, type ItemToCheck, type Session } from '@gab/tools/tool';
import { z } from 'zod';

type Env = Readonly<Record<string, string | undefined>>;

type ChatModel = Parameters<typeof openModel>[0];

/** The checker of the research proposals: the pinned model, the token cap of one check, and how
 * the server opens the model. A test opens it on a stub router. */
export interface CheckSetup {
  readonly checker: ModelConfig;
  readonly tokenCap: number;
  readonly open: (model: string) => ChatModel;
}

/** What the server knows of the check: a checker that is ready, or why no model can check. */
export type SecondCheck =
  | { readonly ready: true; readonly setup: CheckSetup }
  | { readonly ready: false; readonly reason: string };

/** The variable of the token cap of one check of a research batch. */
const CHECK_CAP_VARIABLE = 'RESEARCH_CHECK_TOKEN_CAP';

// Each variable that the check reads. No other value of the environment file reaches the server.
const CHECK_VARIABLES =
  /^(?:OPENROUTER_API_KEY|OPENROUTER_BASE_URL|CHECKER_[A-Z_]+|RESEARCH_CHECK_TOKEN_CAP)$/u;

/** The values of the check: those of the environment file of the stack, and over them each one
 * that the process sets. Only the variables of the check are kept, so no other secret of the
 * stack reaches the research server. */
export const checkEnvOf = (file: string | null, env: Env): Env => {
  const given = [
    ...Object.entries(file === null ? {} : parseEnv(file)),
    ...Object.entries(env).filter(([, value]) => (value?.trim() ?? '') !== ''),
  ];
  return Object.fromEntries(given.filter(([name]) => CHECK_VARIABLES.test(name)));
};

const NAME = 'research-check';
const VERSION = 'v1';

const PROMPT = readFileSync(new URL('./check-prompt.md', import.meta.url), 'utf8');

// Origin: decided, not calibrated. A token holds three bytes of UTF-8 text or more, for the
// languages of the sources, so the estimate is high and a batch over the cap is never sent.
const BYTES_PER_TOKEN = 3;

/** Reads the checker of the research proposals. A value that is absent or wrong gives the
 * sentence that names it, and the server then marks each batch as checked by no model. */
export const readSecondCheck = (env: Env, send?: typeof fetch): SecondCheck => {
  try {
    const checker = readModelConfig('CHECKER', env);
    const tokenCap = readTokenCap(env, CHECK_CAP_VARIABLE);
    // The key is read here, so a missing key stops the check at the start and not at a call.
    openrouterModel(checker.model, env, send);
    return {
      ready: true,
      setup: { checker, tokenCap, open: (model) => openrouterModel(model, env, send) },
    };
  } catch (cause) {
    return { ready: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
};

/** The model family of the research AI, from the name that its client gives. Null for a client
 * that the server does not know. */
export const readerFamilyOf = (client: string | undefined): string | null => {
  const name = client?.toLowerCase() ?? '';
  if (name.includes('claude')) return 'anthropic';
  if (name.includes('codex')) return 'openai';
  return null;
};

const RECORD_CALL = `SELECT public.record_model_call($1::text, $2::text, $3::text, $4::text, $5::text,
  $6::int, $7::text, NULL::uuid, $8::text, $9::int, $10::int)::text AS id`;

const recorded = z.array(z.object({ id: z.uuid() })).length(1);

const recordCall = async (session: Session, call: CallRecord): Promise<string> => {
  const { rows } = await session.query(RECORD_CALL, [
    NAME,
    VERSION,
    PROVIDER,
    call.requested,
    call.promptSha256,
    call.latencyMs,
    call.outcome,
    call.served ?? null,
    call.inputTokens,
    call.outputTokens,
  ]);
  return recorded.parse(rows)[0]?.id ?? '';
};

const estimate = (messages: readonly Message[]): number =>
  Math.ceil(Buffer.byteLength(JSON.stringify(messages), 'utf8') / BYTES_PER_TOKEN);

/** Checks one batch of the research AI in one question to the checker. It throws a
 * `CheckFailure` with the reason when no verdict can come: the family of the reader is unknown
 * or is the family of the checker, the batch is above the cap, or the model failed. */
export const checkBatch = async (
  setup: CheckSetup,
  session: Session,
  readerFamily: string | null,
  items: readonly ItemToCheck[],
): Promise<ReadonlyMap<string, CheckVerdict>> => {
  if (readerFamily === null)
    throw new CheckFailure('the server does not know the model family of the research AI');
  if (readerFamily.toLowerCase() === setup.checker.family.trim().toLowerCase())
    throw new CheckFailure(
      `the checker is of the family ${readerFamily}, which is the family of the research AI`,
    );
  const messages: Message[] = [
    { role: 'system', content: PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        claims: items.map((item) => ({ ref: item.ref, ...item.claim, passages: item.passages })),
      }),
    },
  ];
  const needed = estimate(messages) + setup.checker.line.maxAnswerTokens;
  if (needed > setup.tokenCap)
    throw new CheckFailure(
      `the batch needs about ${String(needed)} tokens, above the cap of ${String(setup.tokenCap)} ` +
        'tokens of one check; propose smaller batches',
    );
  const model = openModel(setup.open(setup.checker.model), setup.checker.line, {
    record: (call) => recordCall(session, call),
  });
  const asked = await model.ask({
    messages,
    shape: checkAnswer,
    budget: openBudget(setup.tokenCap),
  });
  if (!asked.ok) throw new CheckFailure(`the checker failed: ${asked.failure.reason}`);
  if (!('value' in asked)) throw new CheckFailure('the checker answered with a tool call');
  return new Map(
    verdictsOf(
      items.map((item) => item.ref),
      asked.value,
    ),
  );
};

const RECORD_CHECK = 'SELECT public.record_act_check($1::uuid, $2, $3, $4, $5)';

// The part of the answer of the propose tool that names the act of each item.
const proposed = z.object({
  proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid() })),
});

/** Keeps the verdict of the checker as the check of each act of the batch, so the rules can
 * decide. An item with no verdict keeps no check. The record keeps the first check of an act. */
export const recordChecks = async (
  session: Session,
  checker: ModelConfig,
  readerFamily: string,
  output: unknown,
  verdicts: ReadonlyMap<string, CheckVerdict>,
): Promise<void> => {
  for (const one of proposed.parse(output).proposals) {
    const said = verdicts.get(one.ref);
    if (said === undefined) continue;
    await session.query(RECORD_CHECK, [
      one.proposalId,
      checker.model,
      checker.family,
      readerFamily,
      said.verdict,
    ]);
  }
};
