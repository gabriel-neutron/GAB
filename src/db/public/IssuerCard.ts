import type { OriginatorId } from './Originator';

export default interface IssuerCard {
  issuer_id: OriginatorId;

  hosts: string[];

  tls_names: string[];

  url_patterns: string[];

  record_kinds: string[];

  fields: Record<string, unknown>;

  identifier_types: string[];

  terms_of_use: string | null;

  jurisdiction: string | null;

  sanctions_regime: string | null;

  approved_sha256: string;

  approved_on: Date;

  approval_reason: string;

  source_file: string;
}

export interface IssuerCardInitializer {
  issuer_id: OriginatorId;

  hosts: string[];

  tls_names?: string[];

  url_patterns?: string[];

  record_kinds?: string[];

  fields?: Record<string, unknown>;

  identifier_types?: string[];

  terms_of_use?: string | null;

  jurisdiction?: string | null;

  sanctions_regime?: string | null;

  approved_sha256: string;

  approved_on: Date;

  approval_reason: string;

  source_file: string;
}

export interface IssuerCardMutator {
  issuer_id?: OriginatorId;

  hosts?: string[];

  tls_names?: string[];

  url_patterns?: string[];

  record_kinds?: string[];

  fields?: Record<string, unknown>;

  identifier_types?: string[];

  terms_of_use?: string | null;

  jurisdiction?: string | null;

  sanctions_regime?: string | null;

  approved_sha256?: string;

  approved_on?: Date;

  approval_reason?: string;

  source_file?: string;
}
