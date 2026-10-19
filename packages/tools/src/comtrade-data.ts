import { z } from 'zod';

import { storeRegister, type RegisterRequest } from './register-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { anyAnswerOf, UpstreamFault, webFromReach } from './web-access.ts';

const BASE = 'https://comtradeapi.un.org';
const REGISTER = 'UN Comtrade';

// External constraints of the free key: 500 calls a day, one call a second and 100 000 rows a
// call. A call that returns the cap of rows may be cut, so the tool refuses it.
const MAX_ROWS = 100_000;
const MIN_GAP_MS = 1100;

// The time of the last call in this process. Assumption of the first build: one server process
// holds one key, so one clock is enough.
let lastCallAt = 0;

/** Clears the clock of the rate limit. A test calls it. */
export const resetComtradeClock = (): void => {
  lastCallAt = 0;
};

const SENTENCE =
  'The United Nations asks for a written permission to redistribute Comtrade data, so this document stays internal and no release publishes it.';

// Assumption: the answer is JSON with a `data` array and an `error` text. Not checked against a
// live call.
const answerShape = z.object({
  data: z.array(z.unknown()),
  error: z.string().nullish(),
});

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  reporter: z.string(),
  period: z.string(),
  flow: z.enum(['X', 'M']),
  hsCode: z.string(),
  partner: z.string(),
  rows: z.number().int(),
  licence: z.string(),
});

export const comtradeData = defineTool({
  name: 'comtrade_data',
  description:
    'Reads the UN Comtrade trade statistics of one reporter for one period, one flow (X for ' +
    'exports, M for imports), one HS code and one partner, and stores the answer as a document. ' +
    'Codes are the numeric UN codes, for example 643 for Russia and 156 for China, and 0 for the ' +
    'world. The period is a year (2023) or a month (202306). The tool needs a free key: with no ' +
    'key set, it refuses and names the setting. The free key allows 500 calls a day, one call a ' +
    'second and 100 000 rows a call. The stored address holds no key. The data has a restricted ' +
    'licence, so the document stays internal.',
  input: z.strictObject({
    reporter: z.string().regex(/^\d{1,4}$/u, { error: 'the reporter is a numeric UN code' }),
    period: z
      .string()
      .regex(/^\d{4}(?:0[1-9]|1[0-2])?$/u, { error: 'the period is a year or a month, YYYYMM' }),
    flow: z.enum(['X', 'M']),
    hsCode: z.string().regex(/^\d{2,6}$/u, { error: 'the HS code has 2 to 6 digits' }),
    partner: z
      .string()
      .regex(/^\d{1,4}$/u, { error: 'the partner is a numeric UN code' })
      .default('0'),
  }),
  output: outputShape,
  async run(session, input, reach) {
    const web = webFromReach(reach);
    const key = web.comtradeKey ?? '';
    if (key === '')
      throw new ToolRefusal(
        'comtrade_data needs a key: set COMTRADE_API_KEY in the research workspace',
      );
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');

    const query = new URLSearchParams({
      reporterCode: input.reporter,
      period: input.period,
      flowCode: input.flow,
      cmdCode: input.hsCode,
      partnerCode: input.partner,
    });
    // The stored address has no key and no cap: it names the read and nothing else.
    const frequency = input.period.length === 4 ? 'A' : 'M';
    const url = `${BASE}/data/v1/get/C/${frequency}/HS?${query.toString()}`;

    // The slot is reserved before the wait, so calls that run together take slots one after the
    // other.
    const now = reach.now().getTime();
    const slot = Math.max(now, lastCallAt + MIN_GAP_MS);
    lastCallAt = slot;
    if (slot > now)
      await (reach.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms))))(slot - now);

    query.set('maxRecords', String(MAX_ROWS));
    let answer;
    try {
      answer = await anyAnswerOf(web, `${BASE}/data/v1/get/C/${frequency}/HS?${query.toString()}`, {
        headers: { accept: 'application/json', 'Ocp-Apim-Subscription-Key': key },
      });
    } catch (fault) {
      if (fault instanceof UpstreamFault) throw new ToolRefusal(`${REGISTER}: ${fault.message}`);
      throw fault;
    }
    // A sentence below never repeats the body: the body is the words of the server.
    if (answer.status === 429)
      throw new ToolRefusal(
        // The word in the body is a hint only. Both causes are named, so a changed wording of
        // the server gives no wrong advice.
        `${REGISTER} stopped the call with a limit: ${
          /volume/iu.test(answer.body)
            ? 'the daily quota of 500 calls is probably spent, so try again tomorrow.'
            : 'the rate limit of one call a second is probably the cause, so try again in a few seconds.'
        } The daily quota (500 calls) and the rate limit (one call a second) are the two causes.`,
      );
    if (answer.status === 400)
      throw new ToolRefusal(
        `${REGISTER} refused the request as bad: check the codes of the reporter, the partner and the HS code, and the period`,
      );
    if (answer.status === 401 || answer.status === 403)
      throw new ToolRefusal(`${REGISTER} refused the key: check COMTRADE_API_KEY`);
    if (answer.status < 200 || answer.status > 299)
      throw new ToolRefusal(`${REGISTER} answered ${String(answer.status)}`);
    if (answer.body.includes(key))
      throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not store`);

    let json: unknown;
    try {
      json = JSON.parse(answer.body) as unknown;
    } catch {
      throw new ToolRefusal(`${REGISTER} gave an answer that is not JSON`);
    }
    const found = answerShape.safeParse(json);
    if (!found.success)
      throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not read`);
    if (found.data.error !== undefined && found.data.error !== null && found.data.error !== '')
      throw new ToolRefusal(`${REGISTER} gave an error in its answer`);
    if (found.data.data.length >= MAX_ROWS)
      throw new ToolRefusal(
        `${REGISTER} gave ${String(MAX_ROWS)} rows, the most that one call returns, so the answer may be cut: ` +
          'read a shorter period or a narrower HS code',
      );

    const request: RegisterRequest = { url, register: REGISTER, provider: 'un_comtrade' };
    const stored = await storeRegister(
      session,
      reach,
      {
        ...request,
        title:
          `UN Comtrade ${input.flow === 'X' ? 'exports' : 'imports'} of reporter ${input.reporter} ` +
          `to partner ${input.partner}, HS ${input.hsCode}, period ${input.period}`,
      },
      { body: answer.body, json },
    );
    return {
      ...stored,
      reporter: input.reporter,
      period: input.period,
      flow: input.flow,
      hsCode: input.hsCode,
      partner: input.partner,
      rows: found.data.data.length,
      licence: SENTENCE,
    };
  },
});
