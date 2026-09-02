import type { DocumentsId } from './Documents';

/** Identifier type for public.jobs */
export type JobsId = string & { __brand: 'public.jobs' };

export default interface Jobs {
  id: JobsId;

  document_id: DocumentsId;

  status: string;

  attempts: number;

  network_failures: number;

  rejected_failures: number;

  failure_kind: string | null;

  failure_reason: string | null;

  claimed_by: string | null;

  claimed_at: Date | null;

  created_at: Date;

  updated_at: Date;

  finished_at: Date | null;
}

export interface JobsInitializer {
  id?: JobsId;

  document_id: DocumentsId;

  status?: string;

  attempts?: number;

  network_failures?: number;

  rejected_failures?: number;

  failure_kind?: string | null;

  failure_reason?: string | null;

  claimed_by?: string | null;

  claimed_at?: Date | null;

  created_at?: Date;

  updated_at?: Date;

  finished_at?: Date | null;
}

export interface JobsMutator {
  id?: JobsId;

  document_id?: DocumentsId;

  status?: string;

  attempts?: number;

  network_failures?: number;

  rejected_failures?: number;

  failure_kind?: string | null;

  failure_reason?: string | null;

  claimed_by?: string | null;

  claimed_at?: Date | null;

  created_at?: Date;

  updated_at?: Date;

  finished_at?: Date | null;
}
