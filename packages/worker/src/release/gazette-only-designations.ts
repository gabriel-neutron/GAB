import type { ReleaseRecord } from './release-record.ts';

const TYPES: ReadonlySet<string> = new Set(['designated_by', 'restricted_by']);

// External constraint: the hosts of the Federal Register, GovInfo and the Canada Gazette. A page
// there is not the list line, so by the research rule it counts in no regime until the SDN or UK
// list line backs it.
const GAZETTE_HOST = /(?:^|\.)(?:govinfo\.gov|federalregister\.gov|gazette\.gc\.ca)$/u;

const isGazette = (uri: string | null | undefined): boolean => {
  try {
    return uri !== null && uri !== undefined && GAZETTE_HOST.test(new URL(uri).hostname);
  } catch {
    return false;
  }
};

/** The identifiers of the `designated_by` and `restricted_by` relations whose every source is a
 * page of the Federal Register, GovInfo or the Canada Gazette. A relation with no source is not
 * listed. */
export const gazetteOnlyDesignations = (record: ReleaseRecord): string[] =>
  record.relations
    .filter(
      (one) =>
        TYPES.has(one.type) &&
        one.sources.length > 0 &&
        one.sources.every((id) => isGazette(record.documents.get(id)?.uri)),
    )
    .map((one) => one.id);
