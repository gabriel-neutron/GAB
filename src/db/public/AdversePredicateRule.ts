/** Identifier type for public.adverse_predicate_rule */
export type AdversePredicateRuleId = string & { __brand: 'public.adverse_predicate_rule' };

export default interface AdversePredicateRule {
  id: AdversePredicateRuleId;

  load_id: string;

  source_file: string;

  loaded_at: Date;

  row_kind: string;

  subject_kind: string;

  predicate: string;

  class: string;

  lang: string | null;

  keyword: string | null;

  key: string | null;
}

export interface AdversePredicateRuleInitializer {
  id?: AdversePredicateRuleId;

  load_id: string;

  source_file: string;

  loaded_at?: Date;

  row_kind: string;

  subject_kind: string;

  predicate: string;

  class: string;

  lang?: string | null;

  keyword?: string | null;

  key?: string | null;
}

export interface AdversePredicateRuleMutator {
  id?: AdversePredicateRuleId;

  load_id?: string;

  source_file?: string;

  loaded_at?: Date;

  row_kind?: string;

  subject_kind?: string;

  predicate?: string;

  class?: string;

  lang?: string | null;

  keyword?: string | null;

  key?: string | null;
}
