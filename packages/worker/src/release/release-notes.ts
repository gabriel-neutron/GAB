import type { NatoCoverage } from '@gab/release/coverage';

import type { ReleaseFile } from './csv-export.ts';
import { NOT_RATED } from './nato-pair.ts';
import type { ReleaseHeading } from './release-heading.ts';

/** The path of the release notes in a release folder. */
export const NOTES_PATH = 'release-notes.md';

const percent = (paired: number, claims: number): string =>
  `${(claims === 0 ? 0 : (100 * paired) / claims).toFixed(1)}%`;

/** The release notes: the title and the disclaimer of the release, and, when the release shows
 * the NATO pair, the share of the public claims with a full pair, in all and by type. A claim with
 * no full pair is "not rated" in each file. */
export const releaseNotes = (
  heading: ReleaseHeading,
  natoCoverage: NatoCoverage | null,
): ReleaseFile => {
  const lines = [`# ${heading.title}`, '', heading.disclaimer, ''];
  if (natoCoverage !== null) {
    const { all, byType } = natoCoverage;
    lines.push(
      '## The NATO pair of the claims',
      '',
      `${String(all.paired)} of ${String(all.claims)} public claims (${percent(all.paired, all.claims)}) have a full pair: a letter for the author and a digit for the fact. Each other claim is "${NOT_RATED}".`,
      '',
      '| Type | Claims with a full pair | Public claims | Share |',
      '| --- | --- | --- | --- |',
      ...byType.map(
        (one) =>
          `| ${one.group} | ${String(one.paired)} | ${String(one.claims)} | ${percent(one.paired, one.claims)} |`,
      ),
      '',
    );
  }
  return { path: NOTES_PATH, text: `${lines.join('\n')}\n` };
};
