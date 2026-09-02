/** Identifier type for public.proposals */
export type ProposalsId = string & { __brand: 'public.proposals' };

export default interface Proposals {
  id: ProposalsId;

  op: string;

  target_kind: string | null;

  target_id: string | null;

  payload: Record<string, unknown>;

  src: string[];

  names: string[];

  prior_value: Record<string, unknown> | null;

  confidence: string | null;

  dissent: boolean;

  author_role: string;

  xact: string;

  status: string;

  created_at: Date;

  decided_at: Date | null;

  decided_by: string | null;
}

export interface ProposalsInitializer {
  id?: ProposalsId;

  op: string;

  target_kind?: string | null;

  target_id?: string | null;

  payload: Record<string, unknown>;

  src: string[];

  names?: string[];

  prior_value?: Record<string, unknown> | null;

  confidence?: string | null;

  dissent?: boolean;

  author_role: string;

  xact?: string;

  status?: string;

  created_at?: Date;

  decided_at?: Date | null;

  decided_by?: string | null;
}

export interface ProposalsMutator {
  id?: ProposalsId;

  op?: string;

  target_kind?: string | null;

  target_id?: string | null;

  payload?: Record<string, unknown>;

  src?: string[];

  names?: string[];

  prior_value?: Record<string, unknown> | null;

  confidence?: string | null;

  dissent?: boolean;

  author_role?: string;

  xact?: string;

  status?: string;

  created_at?: Date;

  decided_at?: Date | null;

  decided_by?: string | null;
}
