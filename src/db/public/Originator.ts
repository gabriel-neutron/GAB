import type { OriginatorSchemeScheme } from './OriginatorScheme';

/** Identifier type for public.originator */
export type OriginatorId = string & { __brand: 'public.originator' };

export default interface Originator {
  id: OriginatorId;

  scheme: OriginatorSchemeScheme;

  display_name: string;

  kind: string;

  role: string | null;

  jurisdiction: string | null;

  imprint_id: OriginatorId | null;

  merged_into: OriginatorId | null;

  name_collides_with: OriginatorId | null;

  letter: string;

  letter_origin: string;

  operator_letter: string | null;

  operator_letter_reason: string | null;

  gold_set_letter: string | null;

  gold_set_ref: string | null;

  party: string;

  party_reason: string | null;

  party_false_reason: string | null;

  sanctioned_controlled: boolean;

  contested: boolean;

  contested_reason: string | null;

  card_reviewed_at: Date | null;

  last_operator_act_at: Date | null;

  created_at: Date;
}

export interface OriginatorInitializer {
  id: OriginatorId;

  display_name: string;

  kind: string;

  role?: string | null;

  jurisdiction?: string | null;

  imprint_id?: OriginatorId | null;

  merged_into?: OriginatorId | null;

  name_collides_with?: OriginatorId | null;

  letter?: string;

  letter_origin?: string;

  operator_letter?: string | null;

  operator_letter_reason?: string | null;

  gold_set_letter?: string | null;

  gold_set_ref?: string | null;

  party?: string;

  party_reason?: string | null;

  party_false_reason?: string | null;

  sanctioned_controlled?: boolean;

  contested?: boolean;

  contested_reason?: string | null;

  card_reviewed_at?: Date | null;

  last_operator_act_at?: Date | null;

  created_at?: Date;
}

export interface OriginatorMutator {
  id?: OriginatorId;

  display_name?: string;

  kind?: string;

  role?: string | null;

  jurisdiction?: string | null;

  imprint_id?: OriginatorId | null;

  merged_into?: OriginatorId | null;

  name_collides_with?: OriginatorId | null;

  letter?: string;

  letter_origin?: string;

  operator_letter?: string | null;

  operator_letter_reason?: string | null;

  gold_set_letter?: string | null;

  gold_set_ref?: string | null;

  party?: string;

  party_reason?: string | null;

  party_false_reason?: string | null;

  sanctioned_controlled?: boolean;

  contested?: boolean;

  contested_reason?: string | null;

  card_reviewed_at?: Date | null;

  last_operator_act_at?: Date | null;

  created_at?: Date;
}
