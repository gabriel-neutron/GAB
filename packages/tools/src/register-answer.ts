// What the register lookups share: one GET that answers in JSON, and the store of that answer as
// one `api` document. A key travels in a header and never in the address, so the stored address
// never holds it. A redirect is never followed, so a header never reaches a second host.

import type { z } from 'zod';

import { anyAnswerOf, UpstreamFault } from './web-access.ts';
import { storeAnswer } from './store-answer.ts';
import { type Reach, type Session, type Web, ToolRefusal } from './tool.ts';

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export interface RegisterRequest {
  readonly url: string;
  /** The name of the register, for the sentence of a refusal. */
  readonly register: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** The sentence of a refusal when the register moved the record: it gets the new address. A
   * redirect is never followed. */
  readonly moved?: (location: string) => string;
}

export interface RegisterAnswer {
  readonly body: string;
  readonly json: unknown;
}

/** One GET. A 404 gives null, and any other fault is a refusal that names the register. */
export const readRegister = async (
  web: Web,
  request: RegisterRequest,
): Promise<RegisterAnswer | null> => {
  let answer;
  try {
    answer = await anyAnswerOf(web, request.url, {
      ...(request.headers === undefined ? {} : { headers: request.headers }),
    });
  } catch (fault) {
    if (fault instanceof UpstreamFault)
      throw new ToolRefusal(`${request.register}: ${fault.message}`);
    throw fault;
  }
  if (answer.status === 404) return null;
  const location = answer.headers['location'];
  if (request.moved !== undefined && REDIRECTS.has(answer.status) && location !== undefined)
    throw new ToolRefusal(request.moved(location));
  if (answer.status < 200 || answer.status > 299)
    throw new ToolRefusal(`${request.register} answered ${answer.status}`);
  try {
    return { body: answer.body, json: JSON.parse(answer.body) as unknown };
  } catch {
    throw new ToolRefusal(`${request.register} gave an answer that is not JSON`);
  }
};

/** The answer read through its shape. An answer of another shape is a refusal that names the
 * register. */
export const shaped = <Shape extends z.ZodType>(
  register: string,
  shape: Shape,
  json: unknown,
): z.output<Shape> => {
  const found = shape.safeParse(json);
  if (!found.success)
    throw new ToolRefusal(`${register} gave an answer that this tool does not read`);
  return found.data;
};

/** Stores the answer once, as an `api` document that holds the answer as one page. */
export const storeRegister = async (
  session: Session,
  reach: Reach,
  request: RegisterRequest & { readonly title: string },
  answer: RegisterAnswer,
) => {
  if (reach.store === undefined)
    throw new ToolRefusal('this surface gives no object store, so it stores no answer');
  const stored = await storeAnswer(session, reach.store, {
    kind: 'api',
    bytes: new TextEncoder().encode(answer.body),
    mime: 'application/json',
    uri: request.url,
    title: request.title,
    pages: [answer.body],
    day: reach.now().toISOString().slice(0, 10),
  });
  return { document: stored.id, status: stored.status };
};
