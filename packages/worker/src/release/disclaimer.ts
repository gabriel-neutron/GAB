import type { ReleaseManifest } from './release-manifest.ts';

// External constraint: the disclaimer of the operator holds two placeholders, and its words are
// fixed. A change of those words stops the release, so a file never holds a placeholder.
const REPORT = 'Report an error: `<link>`';
const REPLY = 'Right of reply: `<link>`';

/** The disclaimer of the dataset with the two contact addresses of the release in place of the
 * placeholders. */
export const releaseDisclaimer = (
  disclaimer: string,
  contacts: ReleaseManifest['contacts'],
): string => {
  if (!disclaimer.includes(REPORT) || !disclaimer.includes(REPLY))
    throw new Error('the disclaimer of the dataset has no place for the two contact addresses');
  return disclaimer
    .replace(REPORT, `Report an error: ${contacts.reportError}`)
    .replace(REPLY, `Right of reply: ${contacts.rightOfReply}`);
};
