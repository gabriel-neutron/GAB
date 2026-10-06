// What the three web tools share. A tool gets its web from the reach and from nowhere else, and a
// fault of the web is turned into a sentence that holds a status and nothing the web said. An
// address can hold a query and a key can hold a secret, so no message made here repeats either.

import type { Reach, Web, WebAnswer } from './tool.ts';
import { ToolRefusal } from './tool.ts';

// Assumptions of the first build, each one a constant. A search answers inside ten seconds or it
// is a service to try later, and a list of results is a few tens of kilobytes.
export const TIMEOUT_MS = 10_000;
export const MAX_BYTES = 1024 * 1024;

/** A fault of an upstream. Its message is a constant sentence and holds no address and no key. */
export class UpstreamFault extends Error {}

export const webFromReach = (reach: Reach | undefined): Web => {
  if (reach?.web === undefined)
    throw new ToolRefusal('this surface gives no access to the web, so this tool answers nothing');
  return reach.web;
};

export interface Get {
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

/** One GET. Any status is an answer, and only a fault of the network is an UpstreamFault. */
export const anyAnswerOf = async (web: Web, url: string, options: Get = {}): Promise<WebAnswer> => {
  try {
    return await web.get(url, {
      ...(options.headers === undefined ? {} : { headers: options.headers }),
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    });
  } catch {
    throw new UpstreamFault('no whole answer came');
  }
};

/** One GET. A status outside 200 to 299 and a fault of the network both end as an UpstreamFault. */
export const answerOf = async (web: Web, url: string, options: Get = {}): Promise<WebAnswer> => {
  const answer = await anyAnswerOf(web, url, options);
  if (answer.status < 200 || answer.status > 299)
    throw new UpstreamFault(`the server answered ${answer.status}`);
  return answer;
};

/** One GET whose body is JSON. A body that is not JSON is an UpstreamFault. */
export const jsonOf = async (web: Web, url: string, options: Get = {}): Promise<unknown> => {
  const { body } = await answerOf(web, url, options);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new UpstreamFault('the answer is not JSON');
  }
};

/** True for an address that a result may carry: http or https, and nothing else. */
export const isWebAddress = (raw: string): boolean => {
  try {
    const { protocol } = new URL(raw);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

export const clipped = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
