// The class of one answer of a rate-limited host: its hold, and the time to ask again. No code in this
// project solves a CAPTCHA: this class stops the calls.

export type HoldClass = 'quota' | 'captcha' | 'refused';

/** The state of a ticket on a hold of the host. The tick owns these words. */
export type HoldState = 'waiting_quota' | 'waiting_source';

export interface AnswerClass {
  readonly kind: 'ok' | 'not_found' | 'server' | HoldClass;
  /** The state of the ticket. A class with no hold gives null. */
  readonly holdState: HoldState | null;
  /** The time to ask again, for a class with a hold. */
  readonly retryAt: number | null;
}

// Assumption of the first build: the reset of a quota with no stated time is not measured. The real
// run of 6 November 2026 on the register gave 2 CAPTCHAs in 21 extracts at one per 30 s, and one wait
// of this length was enough. No full day is measured, and the shortest wait that is enough is not
// known. The first pilot measures each, and this value then changes.
const HOLD_MS = 60 * 60 * 1000;

/** The wait after a limit of a host that states no time. */
export const HOST_LIMIT_HOLD_MS = HOLD_MS;

// A host states the wait, and a wrong value must not stop a host for ever.
const LONGEST_HOLD_MS = 24 * 60 * 60 * 1000;

const retryAfter = (value: string | undefined, now: number): number | null => {
  if (value === undefined) return null;
  const seconds = Number(value);
  const stated =
    Number.isFinite(seconds) && seconds >= 0 ? now + seconds * 1000 : Date.parse(value);
  return Number.isNaN(stated) ? null : Math.min(stated, now + LONGEST_HOLD_MS);
};

// The Russian word as a whole word, because a name can start with the same letters.
const CHALLENGE_WORD = /captcha|(?<!\p{L})капч(?:а|и|е|у|ей|ам|ами|ах)?(?!\p{L})/iu;

/** The class of an answer. */
export const classOfAnswer = (
  answer: {
    readonly status: number;
    readonly body: string;
    readonly headers: Readonly<Record<string, string>>;
  },
  now: number,
): AnswerClass => {
  // A normal answer of the register holds this field with the value false, and that is no CAPTCHA.
  const body = answer.body.replace(/"captchaRequired"\s*:\s*false/gu, '');
  // A page of another status can name the word in a form or a script, and that is no challenge.
  const canChallenge =
    (answer.status >= 200 && answer.status <= 299) || [401, 403, 429, 503].includes(answer.status);
  if (canChallenge && CHALLENGE_WORD.test(body))
    return { kind: 'captcha', holdState: 'waiting_source', retryAt: now + HOLD_MS };
  if (answer.status === 429 || /volume quota|quota exceeded|rate limit/iu.test(body))
    return {
      kind: 'quota',
      holdState: 'waiting_quota',
      retryAt: retryAfter(answer.headers['retry-after'], now) ?? now + HOLD_MS,
    };
  if (answer.status === 403)
    return { kind: 'refused', holdState: 'waiting_source', retryAt: now + HOLD_MS };
  if (answer.status === 404) return { kind: 'not_found', holdState: null, retryAt: null };
  if (answer.status >= 200 && answer.status <= 299)
    return { kind: 'ok', holdState: null, retryAt: null };
  return { kind: 'server', holdState: null, retryAt: null };
};
