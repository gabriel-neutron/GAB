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

/** A session of the checker role, which goes back to its pool when the call ends. */
export interface CheckerSession extends Session {
  release(): void;
}

/** The sessions of the checker role. Only they write the model call and the checks, because the
 * research AI holds the password of the research role. */
export interface CheckerPool {
  connect(): Promise<CheckerSession>;
}

/** The checker of the research proposals: the pinned model, the token cap of one check, how the
 * server opens the model, and the sessions that write. A test opens the model on a stub router. */
export interface CheckSetup {
  readonly checker: ModelConfig;
  readonly tokenCap: number;
  readonly open: (model: string) => ChatModel;
  readonly pool: CheckerPool;
}

/** What the server knows of the check: a checker that is ready, or why no model can check. */
export type SecondCheck =
  | { readonly ready: true; readonly setup: CheckSetup }
  | { readonly ready: false; readonly reason: string };

/** The variable of the token cap of one check of a research batch. */
const CHECK_CAP_VARIABLE = 'RESEARCH_CHECK_TOKEN_CAP';

// Each variable that the check reads. No other value of the environment file reaches the server.
const CHECK_VARIABLES =
  /^(?:OPENROUTER_API_KEY|OPENROUTER_BASE_URL|CHECKER_[A-Z_]+|RESEARCH_CHECK_TOKEN_CAP|GABRIEL_CHECKER_PASSWORD)$/u;

const CHECKER_PASSWORD = 'GABRIEL_CHECKER_PASSWORD';
const CHECKER_ROLE = 'gabriel_checker';

// External constraint: Notepad of Windows can save the file with a byte order mark, and the parser
// then reads the first name with the mark in it.
const BOM = '\uFEFF';

/** The values of the check: those of the environment file of the stack, and over them each one
 * that the process sets. Only the variables of the check are kept, so no other secret of the
 * stack reaches the research server. */
export const checkEnvOf = (file: string | null, env: Env): Env => {
  const given = [
    ...Object.entries(file === null ? {} : parseEnv(file.startsWith(BOM) ? file.slice(1) : file)),
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

// The checker role reaches the database of the research role, on the same host, with its own name
// and password.
const checkerAddress = (research: string, password: string): string => {
  const address = new URL(research);
  address.username = CHECKER_ROLE;
  address.password = password;
  return address.toString();
};

/** Reads the checker of the research proposals. `research` is the address of the research role,
 * and `poolOf` opens the pool of the checker role on its address. A value that is absent or wrong
 * gives the sentence that names it, and the server then checks no batch. */
export const readSecondCheck = (
  env: Env,
  research: string,
  poolOf: (address: string) => CheckerPool,
  send?: typeof fetch,
): SecondCheck => {
  try {
    const checker = readModelConfig('CHECKER', env);
    const tokenCap = readTokenCap(env, CHECK_CAP_VARIABLE);
    const password = env[CHECKER_PASSWORD]?.trim() ?? '';
    if (password === '')
      throw new Error(`${CHECKER_PASSWORD} is empty or absent. Set it in infra/.env.`);
    // The key is read here, so a missing key stops the check at the start and not at a call.
    openrouterModel(checker.model, env, send);
    return {
      ready: true,
      setup: {
        checker,
        tokenCap,
        open: (model) => openrouterModel(model, env, send),
        pool: poolOf(checkerAddress(research, password)),
      },
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

/** Checks one batch of the research AI in one question to the checker, with no second question:
 * the cap is a hard cap. `writer` is a session of the checker role, which records the call. It
 * throws a `CheckFailure` with the reason when no verdict can come: the family of the reader is
 * unknown or is the family of the checker, the batch is above the cap, or the model failed or
 * gave an answer of a bad shape. */
export const checkBatch = async (
  setup: CheckSetup,
  writer: Session,
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
    record: (call) => recordCall(writer, call),
  });
  const asked = await model.ask({
    messages,
    shape: checkAnswer,
    budget: openBudget(setup.tokenCap),
    retryShape: false,
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

const RECORD_CHECK = 'SELECT public.record_research_check($1::uuid, $2, $3, $4, $5, $6)';

// The part of the answer of the propose tool that names the act of each item.
const proposed = z.object({
  proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid() })),
});

/** Keeps the verdict of the checker, with its reason, as the check of each act of the batch, so
 * the rules can decide. `writer` is a session of the checker role. An item with no verdict keeps
 * no check. The record keeps the first check of an act. */
export const recordChecks = async (
  writer: Session,
  checker: ModelConfig,
  readerFamily: string,
  output: unknown,
  verdicts: ReadonlyMap<string, CheckVerdict>,
): Promise<void> => {
  for (const one of proposed.parse(output).proposals) {
    const said = verdicts.get(one.ref);
    if (said === undefined) continue;
    await writer.query(RECORD_CHECK, [
      one.proposalId,
      checker.model,
      checker.family,
      readerFamily,
      said.verdict,
      said.verdict === 'supported' ? null : said.reason,
    ]);
  }
};
