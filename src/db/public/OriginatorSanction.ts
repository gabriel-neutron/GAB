import type { OriginatorId } from './Originator';
import type { OriginatorFactId } from './OriginatorFact';

/** Identifier type for public.originator_sanction */
export type OriginatorSanctionRegime = string & { __brand: 'public.originator_sanction' };

/** Identifier type for public.originator_sanction */
export type OriginatorSanctionListEntryId = string & { __brand: 'public.originator_sanction' };

export default interface OriginatorSanction {
  originator_id: OriginatorId;

  regime: OriginatorSanctionRegime;

  list_entry_id: OriginatorSanctionListEntryId;

  listed_on: Date | null;

  source: string;

  source_fact: OriginatorFactId | null;

  checked_until: Date | null;
}

export interface OriginatorSanctionInitializer {
  originator_id: OriginatorId;

  regime: OriginatorSanctionRegime;

  list_entry_id: OriginatorSanctionListEntryId;

  listed_on?: Date | null;

  source: string;

  source_fact?: OriginatorFactId | null;

  checked_until?: Date | null;
}

export interface OriginatorSanctionMutator {
  originator_id?: OriginatorId;

  regime?: OriginatorSanctionRegime;

  list_entry_id?: OriginatorSanctionListEntryId;

  listed_on?: Date | null;

  source?: string;

  source_fact?: OriginatorFactId | null;

  checked_until?: Date | null;
}
