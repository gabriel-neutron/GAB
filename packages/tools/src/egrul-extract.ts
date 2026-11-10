// The tool egrul_extract: one extract of the Russian register by the tax number of a company. The
// flow is the one that the public page of the service uses: a form post, a search result, a request
// for the extract, a wait, and a download of a signed PDF.
//
// The panel ruling on this source holds for each line below. The tool keeps one session and never
// opens a new one to reset a limit. The lease of the host holds the pace. A CAPTCHA stops the calls
// of each worker: the tool gives a hold with the wait time, and it solves nothing. The file names
// natural persons, so it is stored under the provider `egrul`, stays internal, and no release
// publishes it.

import { extractText } from '@gab/text';
import { z } from 'zod';

import { extractSubject, ownerSection } from './egrul-text.ts';
import { classOfAnswer, type HoldClass } from './answer-class.ts';
import { HostHeld, LEASE_MS } from './host-lease.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal, type Reach, type Web, type WebAnswer } from './tool.ts';
import { anyAnswerOf, UpstreamFault, webFromReach } from './web-access.ts';

const HOST = 'egrul.nalog.ru';
const BASE = `https://${HOST}`;
const REGISTER = 'The Russian register';
const MIME = 'application/pdf';

// Assumption, from the access test: an extract is ready in some seconds.
const POLL_MS = 1000;
const TIMEOUT_MS = 30_000;
// Assumption: the longest stored extract has 114 pages and is below this size.
const MAX_PDF_BYTES = 32 * 1024 * 1024;

const SENTENCE =
  'A register extract names natural persons, so this document stays internal and no release publishes it. An excerpt can name a legal person only.';

// The session of this process. The lease of the host holds the turn, the pace and the hold, in a file
// that each process reads, so a new process starts no call during a hold.
let cookie = '';

/** Clears the session. A test calls it. */
export const resetEgrulState = (): void => {
  cookie = '';
};

const sleepOf = (reach: Reach): ((ms: number) => Promise<void>) =>
  reach.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));

/** A CAPTCHA, or a refusal of the service that only a wait can end. */
class Hold extends Error {
  readonly kind: HoldClass;
  readonly until: number;
  constructor(kind: HoldClass, until: number) {
    super(kind);
    this.kind = kind;
    this.until = until;
  }
}

const throwOnHold = (
  reach: Reach,
  status: number,
  body: string,
  headers: Readonly<Record<string, string>>,
): void => {
  const found = classOfAnswer({ status, body, headers }, reach.now().getTime());
  if (found.kind === 'captcha' || found.kind === 'quota' || found.kind === 'refused')
    throw new Hold(found.kind, found.retryAt ?? reach.now().getTime());
};

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
  if (status < 200 || status > 299) throw new ToolRefusal(`${REGISTER} answered ${String(status)}`);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ToolRefusal(`${REGISTER} gave an answer that is not JSON`);
  }
};

const shape = <Shape extends z.ZodType>(found: Shape, json: unknown): z.output<Shape> => {
  const read = found.safeParse(json);
  if (!read.success)
    throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not read`);
  return read.data;
};

const token = z.object({ t: z.string().regex(/^[\w-]+$/u) });
// External constraint, read on a real answer of 6 November 2026: the field t of a row names the
// extract, and the field k is something else, so the service answers 500 to it.
const row = z.object({ i: z.string().optional(), t: z.string().regex(/^[\w-]+$/u) });
const result = z.object({ rows: z.array(row).optional(), status: z.string().optional() });
const state = z.object({ status: z.string() });

const stamped = (reach: Reach, path: string): string => {
  const now = String(reach.now().getTime());
  return `${BASE}${path}?r=${now}&_=${now}`;
};

const getJson = async (web: Web, reach: Reach, url: string): Promise<unknown> => {
  let answer: WebAnswer;
  try {
    answer = await anyAnswerOf(web, url, { headers: headersOf(), timeoutMs: TIMEOUT_MS });
  } catch (fault) {
    if (fault instanceof UpstreamFault) throw new ToolRefusal(`${REGISTER}: ${fault.message}`);
    throw fault;
  }
  remember(answer.headers);
  throwOnHold(reach, answer.status, answer.body, answer.headers);
  return parsed(answer.status, answer.body);
};

const postForm = async (web: Web, reach: Reach, taxNumber: string): Promise<string> => {
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
  throwOnHold(reach, answer.status, text, answer.headers);
  return shape(token, parsed(answer.status, text)).t;
};

// The whole read ends inside the lease of the host, so a second worker never meets a read that runs.
const READ_BUDGET_MS = LEASE_MS - 2 * TIMEOUT_MS;

const waitFor = async <Answer>(
  reach: Reach,
  deadline: number,
  ask: () => Promise<Answer>,
  ready: (answer: Answer) => boolean,
): Promise<Answer> => {
  while (reach.now().getTime() < deadline) {
    const answer = await ask();
    if (ready(answer)) return answer;
    await sleepOf(reach)(POLL_MS);
  }
  throw new ToolRefusal(`${REGISTER} did not finish in time`);
};

const downloadOf = async (web: Web, reach: Reach, requestToken: string): Promise<Uint8Array> => {
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
  throwOnHold(reach, answer.status, text, answer.headers);
  throw new ToolRefusal(`${REGISTER} answered ${String(answer.status)} and gave no PDF`);
};

/** The result of the read of one extract: the tool stores it and reads its owner section. */
const readExtract = async (
  web: Web,
  reach: Reach,
  taxNumber: string,
): Promise<Uint8Array | null> => {
  const deadline = reach.now().getTime() + READ_BUDGET_MS;
  const search = await postForm(web, reach, taxNumber);
  const found = await waitFor(
    reach,
    deadline,
    async () =>
      shape(result, await getJson(web, reach, stamped(reach, `/search-result/${search}`))),
    (answer) => answer.status !== 'wait',
  );
  const match = found.rows?.find((candidate) => candidate.i === taxNumber);
  if (match === undefined) return null;
  const request = shape(
    token,
    await getJson(web, reach, stamped(reach, `/vyp-request/${match.t}`)),
  ).t;
  await waitFor(
    reach,
    deadline,
    async () => shape(state, await getJson(web, reach, stamped(reach, `/vyp-status/${request}`))),
    (answer) => answer.status === 'ready',
  );
  return downloadOf(web, reach, request);
};

const ownerShape = z.strictObject({
  kind: z.enum(['legal_person', 'natural_person', 'state_body', 'hidden', 'other']),
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
  holdKind: z.enum(['captcha', 'quota', 'refused']).nullable(),
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
  holdKind: null,
  holdSeconds: null,
  retryAt: null,
  licence: SENTENCE,
});

const holdOf = (taxNumber: string, reach: Reach, kind: HoldClass, until: number): Output => ({
  ...nothing(taxNumber),
  status: 'hold',
  holdKind: kind,
  holdSeconds: Math.ceil((until - reach.now().getTime()) / 1000),
  retryAt: new Date(until).toISOString(),
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
      'person is only counted as one owner of kind natural_person, with no field. A state founder gives the state body that acts for it, of kind state_body. An absent section is no statement ' +
      'that the company has no owner: a joint-stock company often has none. The day of an entry ' +
      'is not a deal date. The tool reads one extract per 30 s, one worker at a time on the machine, so a call ' +
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
      if (reach.hostLease === undefined)
        throw new ToolRefusal(
          'this surface gives no host lease, so it reads no Russian state host',
        );
      let endTurn;
      try {
        endTurn = await reach.hostLease.acquire(HOST);
      } catch (fault) {
        if (fault instanceof HostHeld)
          return holdOf(input.taxNumber, reach, fault.hold, fault.until);
        throw fault;
      }
      try {
        let bytes;
        try {
          bytes = await readExtract(web, reach, input.taxNumber);
        } catch (fault) {
          if (!(fault instanceof Hold)) throw fault;
          await reach.hostLease.hold(HOST, fault.kind, fault.until);
          return holdOf(input.taxNumber, reach, fault.kind, fault.until);
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
        await endTurn();
      }
    },
  });

export const egrulExtract = egrulExtractWith(pagesOfPdf);
