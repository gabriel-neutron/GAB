import type { OriginatorId } from './Originator';
import type { DocumentsId } from './Documents';

/** Identifier type for public.originator_fact */
export type OriginatorFactId = string & { __brand: 'public.originator_fact' };

export default interface OriginatorFact {
  id: OriginatorFactId;

  originator_id: OriginatorId;

  kind: string;

  value: Record<string, unknown>;

  document_id: DocumentsId;

  page: number;

  span_start: number;

  span_end: number;

  status: string;

  refused_reason: string | null;

  proposed_by: string;

  proposed_at: Date;

  decided_at: Date | null;
}

export interface OriginatorFactInitializer {
  id?: OriginatorFactId;

  originator_id: OriginatorId;

  kind: string;

  value: Record<string, unknown>;

  document_id: DocumentsId;

  page: number;

  span_start: number;

  span_end: number;

  status?: string;

  refused_reason?: string | null;

  proposed_by?: string;

  proposed_at?: Date;

  decided_at?: Date | null;
}

export interface OriginatorFactMutator {
  id?: OriginatorFactId;

  originator_id?: OriginatorId;

  kind?: string;

  value?: Record<string, unknown>;

  document_id?: DocumentsId;

  page?: number;

  span_start?: number;

  span_end?: number;

  status?: string;

  refused_reason?: string | null;

  proposed_by?: string;

  proposed_at?: Date;

  decided_at?: Date | null;
}
