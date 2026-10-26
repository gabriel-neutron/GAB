import { NOT_STATED } from '@gab/proposal/geolocation-method';
import type { GeolocationCoverage, NatoCoverage } from '@gab/release/coverage';

import type { ReleaseFile } from './csv-export.ts';
import { NOT_RATED } from './nato-pair.ts';
import type { ReleaseHeading } from './release-heading.ts';

/** The path of the release notes in a release folder. */
export const NOTES_PATH = 'release-notes.md';

const percent = (paired: number, claims: number): string =>
  `${(claims === 0 ? 0 : (100 * paired) / claims).toFixed(1)}%`;

/** The release notes: the title and the disclaimer of the release, the count of distinct claims, the share of the public places
 * with no stated method of geolocation, and, when the release shows the NATO pair, the share of the
 * public claims with a full pair, in all and by type. A claim with no full pair is "not rated" in
 * each file. */
export const releaseNotes = (
  heading: ReleaseHeading,
  natoCoverage: NatoCoverage | null,
  geolocation: GeolocationCoverage,
  claims: number,
): ReleaseFile => {
  const lines = [
    `# ${heading.title}`,
    '',
    heading.disclaimer,
    '',
    '## The claims',
    '',
    `The release holds ${String(claims)} distinct claims. A row of claims.csv is one citation of a claim, so a claim can have more than one row. The column value_in_excerpt says if the value of an attribute claim is found in the excerpt of its row: "yes", "no", "no_excerpt" or "not_tested" (a claim of a relation has no value).`,
    '',
    '## The method of geolocation of the places',
    '',
    `${String(geolocation.notStated)} of ${String(geolocation.places)} places (${percent(geolocation.notStated, geolocation.places)}) have no stated method of geolocation. Each place of the files has a method, or "${NOT_STATED}", in the column geolocation_method of entities.csv and in the properties of entities.geojson.`,
    '',
    '| Method | Places | Share |',
    '| --- | --- | --- |',
    ...geolocation.byMethod.map(
      (one) =>
        `| ${one.method} | ${String(one.count)} | ${percent(one.count, geolocation.places)} |`,
    ),
    '',
  ];
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
