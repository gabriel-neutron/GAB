import type { OriginatorId } from './Originator';
import type { DocumentsId } from './Documents';

/** Identifier type for public.originator_resolution */
export type OriginatorResolutionId = string & { __brand: 'public.originator_resolution' };

export default interface OriginatorResolution {
  id: OriginatorResolutionId;

  originator_id: OriginatorId;

  claim_id: string;

  claim_document: DocumentsId;

  position: string;

  outcome: string;

  settled_by: string;

  settling_document: DocumentsId | null;

  operator_note: string | null;

  settling_captured_at: Date | null;

  claim_document_date: Date;

  fabrication_confirmed_at: Date | null;

  resolved_at: Date;
}

export interface OriginatorResolutionInitializer {
  id?: OriginatorResolutionId;

  originator_id: OriginatorId;

  claim_id: string;

  claim_document: DocumentsId;

  position: string;

  outcome: string;

  settled_by: string;

  settling_document?: DocumentsId | null;

  operator_note?: string | null;

  settling_captured_at?: Date | null;

  claim_document_date: Date;

  fabrication_confirmed_at?: Date | null;

  resolved_at?: Date;
}

export interface OriginatorResolutionMutator {
  id?: OriginatorResolutionId;

  originator_id?: OriginatorId;

  claim_id?: string;

  claim_document?: DocumentsId;

  position?: string;

  outcome?: string;

  settled_by?: string;

  settling_document?: DocumentsId | null;

  operator_note?: string | null;

  settling_captured_at?: Date | null;

  claim_document_date?: Date;

  fabrication_confirmed_at?: Date | null;

  resolved_at?: Date;
}
