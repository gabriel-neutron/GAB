import type { OriginatorId } from './Originator';

/** Identifier type for public.originator_letter_history */
export type OriginatorLetterHistoryId = string & { __brand: 'public.originator_letter_history' };

export default interface OriginatorLetterHistory {
  id: OriginatorLetterHistoryId;

  originator_id: OriginatorId;

  letter: string;

  letter_origin: string;

  reason: Record<string, unknown>;

  changed_at: Date;

  gate_rerun_at: Date | null;
}

export interface OriginatorLetterHistoryInitializer {
  id?: OriginatorLetterHistoryId;

  originator_id: OriginatorId;

  letter: string;

  letter_origin: string;

  reason: Record<string, unknown>;

  changed_at?: Date;

  gate_rerun_at?: Date | null;
}

export interface OriginatorLetterHistoryMutator {
  id?: OriginatorLetterHistoryId;

  originator_id?: OriginatorId;

  letter?: string;

  letter_origin?: string;

  reason?: Record<string, unknown>;

  changed_at?: Date;

  gate_rerun_at?: Date | null;
}
