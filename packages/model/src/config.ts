import { checkTokenCap } from './budget.ts';
import { checkLine, type ModelLine } from './model.ts';
import { pinnedName } from './openrouter.ts';

/** One pinned model of OpenRouter, its family, and how the adapter reaches it. */
export interface ModelConfig {
  readonly model: string;
  /** The family of the model. A check by a model of the same family shares its blind spots. */
  readonly family: string;
  readonly line: ModelLine;
}

type Env = Readonly<Record<string, string | undefined>>;

const textOf = (env: Env, name: string): string => {
  const value = env[name]?.trim() ?? '';
  if (value === '')
    throw new Error(`${name} is empty or absent. Set it in the environment file, with no default.`);
  return value;
};

/** Reads one number from the environment. It throws a sentence that names the variable when the
 * value is absent, blank or not a number. */
export const numberOf = (env: Env, name: string): number => {
  const text = textOf(env, name);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${name} is "${text}", and it is not a number.`);
  return value;
};

// The range of each value is a rule of this package. Here the check runs at the start, and the
// sentence names the variables.
const checked = <T>(name: string, check: () => T): T => {
  try {
    return check();
  } catch (fault) {
    throw new Error(`${name}: ${fault instanceof Error ? fault.message : String(fault)}`, {
      cause: fault,
    });
  }
};

/** Reads one token cap from the environment, and checks its range. */
export const readTokenCap = (env: Env, name: string): number => {
  const cap = numberOf(env, name);
  return checked(name, () => checkTokenCap(cap));
};

/** Reads one model from the variables that start with `prefix`. It throws a sentence that names
 * the variable when a value is absent, blank or wrong. */
export const readModelConfig = (prefix: string, env: Env): ModelConfig => {
  const name = (part: string): string => `${prefix}_${part}`;
  const model = textOf(env, name('MODEL'));
  const line = {
    firstWaitMs: numberOf(env, name('FIRST_WAIT_MS')),
    waitGrowth: numberOf(env, name('WAIT_GROWTH')),
    maxWaitMs: numberOf(env, name('MAX_WAIT_MS')),
    timeoutMs: numberOf(env, name('TIMEOUT_MS')),
    maxAnswerTokens: numberOf(env, name('MAX_ANSWER_TOKENS')),
  };
  return {
    model: checked(name('MODEL'), () => pinnedName(model)),
    family: textOf(env, name('FAMILY')),
    line: checked(`${prefix}_* (the line)`, () => checkLine(line)),
  };
};
