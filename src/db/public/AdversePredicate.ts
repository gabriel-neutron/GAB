import type { ProposalsId } from './Proposals';
import type { EntitiesId } from './Entities';
import type { AdversePredicateRuleId } from './AdversePredicateRule';

/** Identifier type for public.adverse_predicate */
export type AdversePredicateId = string & { __brand: 'public.adverse_predicate' };

export default interface AdversePredicate {
  id: AdversePredicateId;

  claim_id: ProposalsId;

  party_entity_id: EntitiesId | null;

  party_label: string;

  party_kind: string;

  predicate: string;

  class: string;

  set_by: string;

  rule_id: AdversePredicateRuleId | null;

  set_at: Date;
}

export interface AdversePredicateInitializer {
  id?: AdversePredicateId;

  claim_id: ProposalsId;

  party_entity_id?: EntitiesId | null;

  party_label: string;

  party_kind: string;

  predicate: string;

  class: string;

  set_by: string;

  rule_id?: AdversePredicateRuleId | null;

  set_at?: Date;
}

export interface AdversePredicateMutator {
  id?: AdversePredicateId;

  claim_id?: ProposalsId;

  party_entity_id?: EntitiesId | null;

  party_label?: string;

  party_kind?: string;

  predicate?: string;

  class?: string;

  set_by?: string;

  rule_id?: AdversePredicateRuleId | null;

  set_at?: Date;
}
