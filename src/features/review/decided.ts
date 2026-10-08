import { PROPOSERS } from '@gab/proposal/proposer';
import { z } from 'zod';

import { deciderWords } from '@/shared/decider-words';
import { proposerWords } from '@/shared/proposer-words';

import { REJECTION_REASONS } from './rejection';

// Departure: two exports, one job. The shape of one decided act as the writer gives it, and the
// row that the history draws of it.

/** What was decided on an act. */
export type Verdict = 'promoted' | 'rejected';

/** One act that was decided, as the private read of the writer gives it. The reason and
 * the note are private: only the operator reads them. */
export const decidedAct = z.object({
  id: z.string(),
  op: z.string(),
  proposer: z.enum(PROPOSERS),
  status: z.enum(['accepted', 'rejected']),
  decidedAt: z.string(),
  decidedBy: z.string(),
  decidedAs: z.enum(['unit', 'relation', 'group', 'rule']).nullable(),
  decisionOrigin: z.string().nullable(),
  rejectReason: z.string().nullable(),
  rejectNote: z.string().nullable(),
  name: z.string().nullable(),
});

export type DecidedAct = z.output<typeof decidedAct>;

export interface DecidedRow {
  readonly id: string;
  readonly verdict: Verdict;
  readonly verdictWords: string;
  readonly actWords: string;
  /** What the act changed, named as the record names it today. */
  readonly subject: string;
  /** The reason and the note of a rejection. Blank for a promotion: the record keeps no reason
   * for it. */
  readonly reason: string;
  /** The hour as the record states it, for a machine that reads the row. */
  readonly decidedAt: string;
  readonly when: string;
  /** The name the verdict was signed with. It proves no person. */
  readonly signedAs: string;
  /** Who or what decided the act: the rule with its version, or "validated manually by the
   * operator", and whether in a group action. */
  readonly decidedHow: string;
  /** Who proposed the act: the v1 import, the research AI, the extractor or the operator. */
  readonly author: string;
}

const VERDICT_WORDS: Readonly<Record<Verdict, string>> = {
  promoted: 'Promoted into the record',
  rejected: 'Rejected',
};

const ACT_WORDS: Readonly<Record<string, string>> = {
  create_entity: 'New entity',
  create_relation: 'New relation',
  update_attrs: 'Modification',
  update_entity: 'Change of the name or the type',
  update_relation: 'Modification of a relation',
  delete_entity: 'Deletion',
  delete_relation: 'Deletion of a relation',
  merge_entities: 'Merge',
  map_document: 'Mapping of a table',
};

// The hour is written in UTC and to the minute, so two analysts in two zones read one hour.
function whenOf(at: string): string {
  const moment = new Date(at);
  if (Number.isNaN(moment.getTime())) return at;
  const iso = moment.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

const reasonOf = (act: DecidedAct): string => {
  if (act.status === 'accepted') return '';
  // An older rejection kept no reason.
  const words =
    act.rejectReason === null
      ? 'No reason was recorded'
      : (REJECTION_REASONS.find((held) => held.key === act.rejectReason)?.words ??
        act.rejectReason);
  return act.rejectNote === null || act.rejectNote === '' ? words : `${words}: ${act.rejectNote}`;
};

/** One row for each decided act, in the order of the read: the latest decision first. */
export function decidedRows(acts: readonly DecidedAct[]): readonly DecidedRow[] {
  return acts.map((act): DecidedRow => {
    const verdict: Verdict = act.status === 'accepted' ? 'promoted' : 'rejected';
    return {
      id: act.id,
      verdict,
      verdictWords: VERDICT_WORDS[verdict],
      actWords: ACT_WORDS[act.op] ?? act.op.replaceAll('_', ' '),
      subject: act.name ?? 'An element that the act does not name',
      reason: reasonOf(act),
      decidedAt: act.decidedAt,
      when: whenOf(act.decidedAt),
      signedAs: act.decidedBy,
      decidedHow: deciderWords(act.decidedAs, act.decisionOrigin, act.status),
      author: proposerWords(act.proposer),
    };
  });
}
