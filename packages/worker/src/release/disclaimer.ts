import { withReferenceLabel } from '@gab/release/reference-label';

import type { ReleaseManifest } from './release-manifest.ts';

// External constraint: the disclaimer of the operator holds two placeholders, and its words are
// fixed. A change of those words stops the release, so a file never holds a placeholder.
const REPORT = 'Report an error: `<link>`';
const REPLY = 'Corrections: `<link>`';

/** The disclaimer of the dataset with the two contact addresses of the release in place of the
 * placeholders. The key `rightOfReply` holds the address of the Corrections page: it keeps its
 * name, because the published releases have it. */
export const releaseDisclaimer = (
  disclaimer: string,
  contacts: ReleaseManifest['contacts'],
): string => {
  if (!disclaimer.includes(REPORT) || !disclaimer.includes(REPLY))
    throw new Error('the disclaimer of the dataset has no place for the two contact addresses');
  return withReferenceLabel(disclaimer)
    .replace(REPORT, `Report an error: ${contacts.reportError}`)
    .replace(REPLY, `Corrections: ${contacts.rightOfReply}`);
};
