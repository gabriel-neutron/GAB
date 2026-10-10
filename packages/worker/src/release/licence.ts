/** The licence of one row of a release, in the fixed words that a reuser reads. */
export type RowLicence =
  | 'CC-BY 4.0'
  | 'CC-BY-NC 4.0'
  | 'derived fact; source under the provider licence, not redistributed';

// Origin of the list: the licences that the tier of a document reads as open to republish. A word
// that is not named here, and a document with no provider, give the restrictive text, so a new
// word fails closed.
const OPEN = new Set([
  'public-domain',
  'eu-reuse',
  'ogl-v3',
  'cc0',
  'cc-by-4.0',
  'copernicus',
  'own',
]);
const NON_COMMERCIAL = new Set(['cc-by-nc-4.0']);

/** The most permissive licence that the provider licences of the public documents of a row
 * give. `null` is a document with no provider. */
export const rowLicence = (licences: readonly (string | null)[]): RowLicence => {
  if (licences.some((one) => one !== null && OPEN.has(one))) return 'CC-BY 4.0';
  if (licences.some((one) => one !== null && NON_COMMERCIAL.has(one))) return 'CC-BY-NC 4.0';
  return 'derived fact; source under the provider licence, not redistributed';
};
