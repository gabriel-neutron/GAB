// The tool egrul_extract: one extract of the Russian register by the tax number of a company. The
// flow is the one that the public page of the service uses: a form post, a search result, a request
// for the extract, a wait, and a download of a signed PDF.
//
// The panel ruling on this source holds for each line below. The tool keeps one session and never
// opens a new one to reset a limit. A CAPTCHA stops the calls: the tool gives a hold with the wait
// time, and it solves nothing. The file names natural persons, so it is stored under the provider
// `egrul`, stays internal, and no release publishes it.

import { extractText } from '@gab/text';
import { z } from 'zod';

import { extractSubject, ownerSection } from './egrul-text.ts';
import { storeAnswer } from './store-answer.ts';
import {
  defineTool,
  ToolRefusal,
  type AcquireHost,
  type Reach,
  type Web,
  type WebAnswer,
} from './tool.ts';
import { anyAnswerOf, UpstreamFault, webFromReach } from './web-access.ts';

const HOST = 'egrul.nalog.ru';
const BASE = `https://${HOST}`;
const REGISTER = 'The Russian register';
const MIME = 'application/pdf';

// The panel ruling gives this first pace: one extract per 30 s. A faster pace needs a passed test of
// one session at 30 s for 60 extracts.
const GAP_MS = 30_000;
// Assumption of the first build: the reset of the CAPTCHA is not measured. The pilot of the first
// research ticket measures it, and this value then changes.
const HOLD_MS = 60 * 60 * 1000;
// Assumption, from the access test: an extract is ready in some seconds.
const POLL_MS = 1000;
const POLLS = 30;
const TIMEOUT_MS = 30_000;
// Assumption: the longest stored extract has 114 pages and is below this size.
const MAX_PDF_BYTES = 32 * 1024 * 1024;

const SENTENCE =
  'A register extract names natural persons, so this document stays internal and no release publishes it. An excerpt can name a legal person only.';

// The state of this process. A later lease of the supervisor replaces the gate through
// `reach.acquireHost`, and the hold stays here.
let turn: Promise<unknown> = Promise.resolve();
let lastStart = 0;
let heldUntil = 0;
let cookie = '';

/** Clears the gate, the hold and the session. A test calls it. */
export const resetEgrulState = (): void => {
  turn = Promise.resolve();
  lastStart = 0;
  heldUntil = 0;
  cookie = '';
};

const sleepOf = (reach: Reach): ((ms: number) => Promise<void>) =>
  reach.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));

// One caller at a time, and one start per gap. The slot is reserved before the wait.
const pacedGate =
  (reach: Reach): AcquireHost =>
  async () => {
    const before = turn;
    let release = (): void => undefined;
    turn = new Promise<void>((done) => {
      release = done;
    });
    await before;
    try {
      const now = reach.now().getTime();
      const slot = Math.max(now, lastStart + GAP_MS);
      lastStart = slot;
      // A hold that started while this caller waited makes no call, so it does not wait a gap.
      if (slot > now && heldUntil <= now) await sleepOf(reach)(slot - now);
    } catch (fault) {
      release();
      throw fault;
    }
    return release;
  };

/** A CAPTCHA, or a refusal of the service that only a wait can end. */
class Hold extends Error {}

// Each normal answer holds the field captchaRequired with the value false, and that is no CAPTCHA.
const isHold = (status: number, body: string): boolean =>
  status === 403 ||
  status === 429 ||
  /captcha/iu.test(body.replace(/"captchaRequired"\s*:\s*false/gu, ''));

const remember = (headers: Readonly<Record<string, string>>): void => {
  const found = /JSESSIONID=([^;,\s]+)/u.exec(headers['set-cookie'] ?? '');
  if (found?.[1] !== undefined) cookie = `JSESSIONID=${found[1]}`;
};

const headersOf = (): Record<string, string> => ({
  accept: 'application/json, text/javascript, */*; q=0.01',
  referer: `${BASE}/index.html`,
  'x-requested-with': 'XMLHttpRequest',
  ...(cookie === '' ? {} : { cookie }),
});

// A sentence below repeats no part of a body: a search row can name a natural person.
const parsed = (status: number, body: string): unknown => {
  if (isHold(status, body)) throw new Hold();
  if (status < 200 || status > 299) throw new ToolRefusal(`${REGISTER} answered ${String(status)}`);
  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    throw new ToolRefusal(`${REGISTER} gave an answer that is not JSON`);
  }
  if (typeof json === 'object' && json !== null && 'captchaRequired' in json) {
    if (json.captchaRequired === true) throw new Hold();
  }
  return json;
};

const shape = <Shape extends z.ZodType>(found: Shape, json: unknown): z.output<Shape> => {
  const read = found.safeParse(json);
  if (!read.success)
    throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not read`);
  return read.data;
};

const token = z.object({ t: z.string().regex(/^[\w-]+$/u) });
const row = z.object({ i: z.string().optional(), k: z.string().regex(/^[\w-]+$/u) });
const result = z.object({ rows: z.array(row).optional(), status: z.string().optional() });
const state = z.object({ status: z.string() });

const stamped = (reach: Reach, path: string): string => {
  const now = String(reach.now().getTime());
  return `${BASE}${path}?r=${now}&_=${now}`;
};

const getJson = async (web: Web, url: string): Promise<unknown> => {
  let answer: WebAnswer;
  try {
    answer = await anyAnswerOf(web, url, { headers: headersOf(), timeoutMs: TIMEOUT_MS });
  } catch (fault) {
    if (fault instanceof UpstreamFault) throw new ToolRefusal(`${REGISTER}: ${fault.message}`);
    throw fault;
  }
  remember(answer.headers);
  return parsed(answer.status, answer.body);
};

const postForm = async (web: Web, taxNumber: string): Promise<string> => {
  if (web.post === undefined)
    throw new ToolRefusal('this surface gives no POST, so this tool reads no extract');
  // The field of the CAPTCHA stays empty. No code fills it.
  const body = new URLSearchParams({
    vyp3CaptchaToken: '',
    page: '',
    query: taxNumber,
    region: '',
    PreventChromeAutocomplete: '',
  });
  let answer;
  try {
    answer = await web.post(`${BASE}/`, {
      headers: { ...headersOf(), 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      timeoutMs: TIMEOUT_MS,
      maxBytes: 1024 * 1024,
    });
  } catch {
    throw new ToolRefusal(`${REGISTER}: no whole answer came`);
  }
  remember(answer.headers);
  const text = new TextDecoder().decode(answer.bytes);
  return shape(token, parsed(answer.status, text)).t;
};

const waitFor = async <Answer>(
  reach: Reach,
  ask: () => Promise<Answer>,
  ready: (answer: Answer) => boolean,
): Promise<Answer> => {
  for (let poll = 0; poll < POLLS; poll += 1) {
    const answer = await ask();
    if (ready(answer)) return answer;
    await sleepOf(reach)(POLL_MS);
  }
  throw new ToolRefusal(
    `${REGISTER} did not finish in ${String((POLLS * POLL_MS) / 1000)} seconds`,
  );
};

const downloadOf = async (web: Web, requestToken: string): Promise<Uint8Array> => {
  if (web.getBytes === undefined)
    throw new ToolRefusal('this surface gives no download, so this tool reads no extract');
  let answer;
  try {
    answer = await web.getBytes(`${BASE}/vyp-download/${requestToken}`, {
      headers: headersOf(),
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_PDF_BYTES,
    });
  } catch {
    throw new ToolRefusal(`${REGISTER}: no whole answer came`);
  }
  remember(answer.headers);
  if (Buffer.from(answer.bytes.subarray(0, 5)).toString('latin1') === '%PDF-') return answer.bytes;
  const text = new TextDecoder().decode(answer.bytes);
  if (isHold(answer.status, text)) throw new Hold();
  throw new ToolRefusal(`${REGISTER} answered ${String(answer.status)} and gave no PDF`);
};

/** The result of the read of one extract: the tool stores it and reads its owner section. */
const readExtract = async (
  web: Web,
  reach: Reach,
  taxNumber: string,
): Promise<Uint8Array | null> => {
  const search = await postForm(web, taxNumber);
  const found = await waitFor(
    reach,
    async () => shape(result, await getJson(web, stamped(reach, `/search-result/${search}`))),
    (answer) => answer.status !== 'wait',
  );
  const match = found.rows?.find((candidate) => candidate.i === taxNumber);
  if (match === undefined) return null;
  const request = shape(token, await getJson(web, stamped(reach, `/vyp-request/${match.k}`))).t;
  await waitFor(
    reach,
    async () => shape(state, await getJson(web, stamped(reach, `/vyp-status/${request}`))),
    (answer) => answer.status === 'ready',
  );
  return downloadOf(web, request);
};

const ownerShape = z.strictObject({
  kind: z.enum(['legal_person', 'natural_person', 'hidden', 'other']),
  name: z.string().nullable(),
  ogrn: z.string().nullable(),
  inn: z.string().nullable(),
  country: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  sharePercent: z.string().nullable(),
  nominalRub: z.string().nullable(),
  enteredOn: z.string().nullable(),
});

const outputShape = z.strictObject({
  status: z.enum(['stored', 'known', 'not_found', 'hold']),
  taxNumber: z.string(),
  document: z.string().nullable(),
  name: z.string().nullable(),
  ogrn: z.string().nullable(),
  endedOn: z.string().nullable(),
  ownerSection: z.enum(['listed', 'absent', 'unread']).nullable(),
  ownerPages: z.array(z.number().int()),
  owners: z.array(ownerShape),
  /** The time to wait, for a hold. */
  holdSeconds: z.number().int().nullable(),
  retryAt: z.string().nullable(),
  licence: z.string(),
});

type Output = z.output<typeof outputShape>;

const nothing = (taxNumber: string): Output => ({
  status: 'not_found',
  taxNumber,
  document: null,
  name: null,
  ogrn: null,
  endedOn: null,
  ownerSection: null,
  ownerPages: [],
  owners: [],
  holdSeconds: null,
  retryAt: null,
  licence: SENTENCE,
});

const holdOf = (taxNumber: string, reach: Reach): Output => ({
  ...nothing(taxNumber),
  status: 'hold',
  holdSeconds: Math.ceil((heldUntil - reach.now().getTime()) / 1000),
  retryAt: new Date(heldUntil).toISOString(),
});

type PageReader = (bytes: Uint8Array) => Promise<readonly string[]>;

const pagesOfPdf: PageReader = async (bytes) => (await extractText(bytes, MIME)).pages;

/** The tool with its reader of the PDF. A test gives its own reader, because a small test PDF holds
 * no Cyrillic font. */
export const egrulExtractWith = (readPages: PageReader) =>
  defineTool({
    name: 'egrul_extract',
    description:
      'Reads one extract of the Russian register (EGRUL) by the 10-digit tax number (INN) of a ' +
      'company, stores the signed PDF as an internal document, and gives its owner section: the ' +
      'legal persons with OGRN, INN, country, share and the day of the register entry. A natural ' +
      'person is only counted as one owner of kind natural_person, with no field. An absent section is no statement ' +
      'that the company has no owner: a joint-stock company often has none. The day of an entry ' +
      'is not a deal date. The tool reads one extract per 30 s, one caller at a time, so a call ' +
      'can wait. On a CAPTCHA it gives status hold with holdSeconds and retryAt: wait, and call ' +
      'again after that time. It solves no CAPTCHA and it opens no new session to avoid a limit. ' +
      'An excerpt of this document can name a legal person only: propose refuses each other excerpt.',
    input: z.strictObject({
      taxNumber: z.string().regex(/^\d{10}$/u, {
        error:
          'the tax number of a company has 10 digits; a 12-digit number names a natural person',
      }),
    }),
    output: outputShape,
    async run(session, input, reach) {
      const web = webFromReach(reach);
      if (reach?.store === undefined)
        throw new ToolRefusal('this surface gives no object store, so it stores no answer');
      if (reach.now().getTime() < heldUntil) return holdOf(input.taxNumber, reach);
      const release = await (reach.acquireHost ?? pacedGate(reach))(HOST);
      try {
        // A caller that waited at the gate can meet a hold that started during its wait.
        if (reach.now().getTime() < heldUntil) return holdOf(input.taxNumber, reach);
        let bytes;
        try {
          bytes = await readExtract(web, reach, input.taxNumber);
        } catch (fault) {
          if (!(fault instanceof Hold)) throw fault;
          heldUntil = reach.now().getTime() + HOLD_MS;
          return holdOf(input.taxNumber, reach);
        }
        if (bytes === null) return nothing(input.taxNumber);
        const pages = await readPages(bytes);
        if (pages.every((page) => page.trim() === ''))
          throw new ToolRefusal(`${REGISTER} gave a PDF with no text`);
        const subject = extractSubject(pages);
        if (subject.inn !== null && subject.inn !== input.taxNumber)
          throw new ToolRefusal(
            `${REGISTER} gave an extract of another tax number, so this tool stores nothing`,
          );
        const section = ownerSection(pages);
        const stored = await storeAnswer(session, reach.store, {
          kind: 'api',
          bytes,
          mime: MIME,
          // The address holds no token of the service: the token ends with the session.
          uri: `${BASE}/index.html#${input.taxNumber}`,
          title: `EGRUL extract, INN ${input.taxNumber}${subject.ogrn === null ? '' : `, OGRN ${subject.ogrn}`}`,
          pages,
          day: reach.now().toISOString().slice(0, 10),
          provider: 'egrul',
        });
        return {
          ...nothing(input.taxNumber),
          status: stored.status,
          document: stored.id,
          name: subject.name,
          ogrn: subject.ogrn,
          endedOn: subject.endedOn,
          ownerSection: section.state,
          ownerPages: [...section.pages],
          owners: [...section.entries],
        };
      } finally {
        release();
      }
    },
  });

export const egrulExtract = egrulExtractWith(pagesOfPdf);
