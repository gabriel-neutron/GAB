// The live read of the check excerpt_at_source (tools/node-audit-checks.ts). It reads each cited
// document once at its public address with readLive (the deny list, the host lease and the CAPTCHA
// hold of the fetch tools), and keeps the result in <out>/sources, so a resumed run reads no page
// again; only a block or no answer is read again. It has no browser and no proxy: a blocked host is cannot_check(blocked), and a person reads
// the stored copy on the PC (local-check.txt, then pnpm node:audit --record --local-check).
// The text of a page is data only: the audit searches it for the excerpt, and nothing else reads it.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { LiveRefusal, readLive } from '@gab/tools/read-page';
import type { Reach } from '@gab/tools/tool';
import { CHALLENGE_PAGE, unreadablePage } from '@gab/tools/unreadable-page';

import { sha256Of, type SourceRead, type SourceReader } from './node-audit-checks.ts';

/** The name of the list of the documents that the VPS could not read, in the out folder. */
export const LOCAL_CHECK = 'local-check.txt';

// Assumption: no measure supports this gap. A host with no lease gets one read at a time, at this
// pace, so a long run does not look like a flood.
const HOST_GAP_MS = 2000;

interface Cached {
  readonly id: string;
  readonly address: string;
  readonly read: SourceRead;
}

type Cannot = Exclude<SourceRead, { kind: 'text' }>;

const cannot = (reason: Cannot['reason']): SourceRead => ({
  kind: 'cannot_check',
  reason,
});

/** One live read, with its result. No fault of the read stops the run. */
export const readSource = async (address: string, reach: Reach): Promise<SourceRead> => {
  const url = URL.parse(address.trim());
  if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:'))
    return cannot('no_address');
  try {
    const { mime, pages } = await readLive(url.href, reach);
    const unreadable = unreadablePage(mime, pages);
    if (unreadable === CHALLENGE_PAGE) return cannot('blocked');
    if (unreadable !== null) return cannot('unreachable');
    const text = pages.join('\n\n');
    return text.trim() === '' ? cannot('not_text') : { kind: 'text', text };
  } catch (fault) {
    if (fault instanceof LiveRefusal) return cannot(fault.fault);
    // A fault that the guard does not name (a socket fault, a fault of the text tools) is no reason
    // to stop the audit of the other documents.
    return cannot('unreachable');
  }
};

// A block or no answer can end soon (a hold, a rate limit, a timeout), so a resumed run reads that
// document again. The other results stay for good.
const KEPT: ReadonlySet<string> = new Set(['text', 'not_text', 'no_address']);
const REASONS: ReadonlySet<string> = new Set(['blocked', 'unreachable', 'not_text', 'no_address']);

/** A file of the cache, or null when it is cut or of another shape: the run then reads again. */
const cachedOf = (file: string): Cached | null => {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { id, address, read } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof address !== 'string') return null;
  if (typeof read !== 'object' || read === null) return null;
  const { kind, text, reason } = read as Record<string, unknown>;
  if (kind === 'text' && typeof text === 'string') return { id, address, read: { kind, text } };
  if (kind === 'cannot_check' && typeof reason === 'string' && REASONS.has(reason))
    return { id, address, read: { kind, reason: reason as Cannot['reason'] } };
  return null;
};

/** The reader of the run: the cache in <out>/sources first, then one live read. */
export const sourceReader = (
  out: string,
  reach: Reach,
  gapMs: number = HOST_GAP_MS,
): SourceReader => {
  const folder = join(out, 'sources');
  mkdirSync(folder, { recursive: true });
  const lastRead = new Map<string, number>();
  const thisRun = new Set<string>();
  return async (id, address) => {
    // The file name is a hash, because a document id can hold a sign that a file name cannot.
    const file = join(folder, `${sha256Of(new TextEncoder().encode(id))}.json`);
    const held = existsSync(file) ? cachedOf(file) : null;
    if (
      held !== null &&
      held.address === address &&
      (thisRun.has(id) || KEPT.has(held.read.kind === 'text' ? 'text' : held.read.reason))
    )
      return held.read;
    const host = URL.parse(address.trim())?.hostname ?? '';
    const wait = (lastRead.get(host) ?? 0) + gapMs - Date.now();
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
    const read = await readSource(address, reach);
    lastRead.set(host, Date.now());
    thisRun.add(id);
    // A stop during the write leaves the old file or none, never a cut one.
    writeFileSync(`${file}.part`, JSON.stringify({ id, address, read } satisfies Cached));
    renameSync(`${file}.part`, file);
    return read;
  };
};

/** The lines of local-check.txt: one for each document that the run could not read, with the reason,
 * in the order of the ids. */
export const localCheckLines = (out: string): string[] => {
  const folder = join(out, 'sources');
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => cachedOf(join(folder, name)))
    .flatMap((one) => (one?.read.kind === 'cannot_check' ? [`${one.id} ${one.read.reason}`] : []))
    .sort();
};

/** The document ids of a local-check file: the first word of each line. */
export const localCheckIds = (text: string): Set<string> =>
  new Set(
    text
      .split('\n')
      .map((line) => line.trim().split(/\s+/u)[0] ?? '')
      .filter((one) => one !== ''),
  );
