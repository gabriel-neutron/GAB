import { attributeName } from './attribute-name.ts';
import { relationWords } from './relation-words.ts';
import type { SiteClaim } from './site-release.ts';

/** What a claim says, in words: the relation from its first end, or the subject, the readable
 * name of the key and the value. */
export const claimText = (claim: SiteClaim): string =>
  claim.kind === 'relation'
    ? `${claim.relation.fromLabel} ${relationWords(claim.relation.type, false)} ${claim.relation.toLabel}`
    : `${claim.subjectLabel}: ${attributeName(claim.attribute)} ${claim.value}`;
