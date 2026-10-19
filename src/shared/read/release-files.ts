// The files of a release, fetched from the folder the application was built with. The reader of
// the files lives in `@gab/release`, and the writer of the release uses the same one.

import { readSiteRelease, type SiteRelease } from '@gab/release/site-release';
import { z } from 'zod';

const listing = z.object({ files: z.array(z.object({ path: z.string() })) });

/** The site holds no release folder: no manifest answers, or the host serves a page in its place. */
export class ReleaseAbsent extends Error {}

async function textOf(address: URL): Promise<string> {
  let answer: Response;
  try {
    answer = await fetch(address);
  } catch {
    throw new Error(`The release file ${address.pathname} cannot be fetched.`);
  }
  if (!answer.ok) {
    throw new Error(`The release file ${address.pathname} answered ${answer.status}.`);
  }
  return answer.text();
}

/** Reads the release at `folder`: its manifest, then each file that the manifest lists. */
export async function fetchRelease(folder: URL): Promise<SiteRelease> {
  let manifest: string;
  try {
    manifest = await textOf(new URL('manifest.json', folder));
  } catch (cause) {
    throw new ReleaseAbsent(cause instanceof Error ? cause.message : 'No release manifest.');
  }
  let json: unknown;
  try {
    json = JSON.parse(manifest);
  } catch {
    throw new ReleaseAbsent(
      'The release manifest is not JSON. The host may serve a page in its place.',
    );
  }
  const listed = listing.safeParse(json);
  if (!listed.success) throw new Error('The release manifest does not list files.');
  const files = new Map([['manifest.json', manifest]]);
  const texts = await Promise.all(
    listed.data.files.map(async ({ path }) => [path, await textOf(new URL(path, folder))] as const),
  );
  for (const [path, text] of texts) files.set(path, text);
  return readSiteRelease(files);
}
