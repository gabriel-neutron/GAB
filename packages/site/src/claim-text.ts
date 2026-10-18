import { attributeName } from './attribute-name.ts';
import { relationWords } from '@gab/proposal/relation-types';
import type { SiteClaim } from '@gab/release/site-release';

/** What a claim says, in words: the relation from its first end, or the subject, the readable
 * name of the key and the value. */
export const claimText = (claim: SiteClaim): string =>
  claim.kind === 'relation'
    ? `${claim.relation.fromLabel} ${relationWords(claim.relation.type, false)} ${claim.relation.toLabel}`
    : `${claim.subjectLabel}: ${attributeName(claim.attribute)} ${claim.value}`;
