import { z } from 'zod';

import { readBody } from './body.ts';
import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

// Departure: three exports, one job. The operator reads the merge candidates across two scripts,
// and confirms or refuses each one.

const READ =
  'SELECT key, type, first_id, first_label, first_name, second_id, second_label, second_name ' +
  'FROM public.name_candidates()';
const CONFIRM =
  'SELECT proposal_id, target_id FROM public.confirm_name_candidate($1::text, $2::uuid, $3::uuid)';
const REFUSE = 'SELECT public.refuse_name_candidate($1::text, $2::uuid, $3::uuid) AS rows';

const candidateRow = z.object({
  key: z.string(),
  type: z.string(),
  first_id: z.uuid(),
  first_label: z.string(),
  first_name: z.string(),
  second_id: z.uuid(),
  second_label: z.string(),
  second_name: z.string(),
});

const confirmation = z.strictObject({ survivorId: z.uuid(), absorbedId: z.uuid() });
const refusal = z.strictObject({ firstId: z.uuid(), secondId: z.uuid() });

/** One entity of a candidate: its identifier, its label, and its name that matched. */
interface CandidateEntity {
  readonly id: string;
  readonly label: string;
  readonly name: string;
}

/** Two entities of one type whose Latin and Cyrillic names give one transliteration key. */
interface NameCandidate {
  readonly key: string;
  readonly type: string;
  readonly first: CandidateEntity;
  readonly second: CandidateEntity;
}

/** The candidates that wait for the operator, in the order of the type and the key. */
export const readNameCandidates = async (
  pool: Sessions,
): Promise<DoorAct<{ readonly candidates: readonly NameCandidate[] }>> => {
  const answer = await runStatement(pool, READ, []);
  if (answer.outcome !== 'answered') return answer;
  const rows = z.array(candidateRow).safeParse(answer.rows);
  if (!rows.success) return refused('the record gave candidates that this writer cannot read');
  return {
    outcome: 'done',
    reply: {
      candidates: rows.data.map((row) => ({
        key: row.key,
        type: row.type,
        first: { id: row.first_id, label: row.first_label, name: row.first_name },
        second: { id: row.second_id, label: row.second_label, name: row.second_name },
      })),
    },
  };
};

// The decision stands, so an answer that this writer cannot read is a doubt, not a refusal.
const UNREAD = 'the record took the decision and gave an answer that this writer cannot read';

/** Confirm one candidate: the absorbed entity merges into the survivor, and its label becomes a
 * former name of the survivor. */
export const confirmNameCandidate = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly proposalId: string; readonly targetId: string }>> => {
  const given = readBody(raw, confirmation, 'the body names a survivor and an absorbed entity');
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, CONFIRM, [
    DECIDED_BY,
    given.body.survivorId,
    given.body.absorbedId,
  ]);
  if (answer.outcome !== 'answered') return answer;
  const row = z.object({ proposal_id: z.uuid(), target_id: z.uuid() }).safeParse(answer.rows[0]);
  return row.success
    ? { outcome: 'done', reply: { proposalId: row.data.proposal_id, targetId: row.data.target_id } }
    : { outcome: 'doubt', reply: { doubt: UNREAD } };
};

/** Refuse one candidate. The pair is never proposed again. */
export const refuseNameCandidate = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly refused: number }>> => {
  const given = readBody(raw, refusal, 'the body names the two entities of a candidate');
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, REFUSE, [
    DECIDED_BY,
    given.body.firstId,
    given.body.secondId,
  ]);
  if (answer.outcome !== 'answered') return answer;
  const row = z.object({ rows: z.number().int() }).safeParse(answer.rows[0]);
  return row.success
    ? { outcome: 'done', reply: { refused: row.data.rows } }
    : { outcome: 'doubt', reply: { doubt: UNREAD } };
};
