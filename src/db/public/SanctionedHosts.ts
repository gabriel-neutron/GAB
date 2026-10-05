/** Identifier type for public.sanctioned_hosts */
export type SanctionedHostsHostOrAccount = string & { __brand: 'public.sanctioned_hosts' };

/** Identifier type for public.sanctioned_hosts */
export type SanctionedHostsRegime = string & { __brand: 'public.sanctioned_hosts' };

/** Identifier type for public.sanctioned_hosts */
export type SanctionedHostsListEntryId = string & { __brand: 'public.sanctioned_hosts' };

export default interface SanctionedHosts {
  host_or_account: SanctionedHostsHostOrAccount;

  regime: SanctionedHostsRegime;

  list_entry_id: SanctionedHostsListEntryId;

  outlet: string;

  list_url: string;

  outlet_registration: string | null;

  entry_registration: string | null;

  listed_on: Date | null;

  checked_until: Date | null;

  approved_sha256: string;

  approved_on: Date;
}

export interface SanctionedHostsInitializer {
  host_or_account: SanctionedHostsHostOrAccount;

  regime: SanctionedHostsRegime;

  list_entry_id: SanctionedHostsListEntryId;

  outlet: string;

  list_url: string;

  outlet_registration?: string | null;

  entry_registration?: string | null;

  listed_on?: Date | null;

  checked_until?: Date | null;

  approved_sha256: string;

  approved_on: Date;
}

export interface SanctionedHostsMutator {
  host_or_account?: SanctionedHostsHostOrAccount;

  regime?: SanctionedHostsRegime;

  list_entry_id?: SanctionedHostsListEntryId;

  outlet?: string;

  list_url?: string;

  outlet_registration?: string | null;

  entry_registration?: string | null;

  listed_on?: Date | null;

  checked_until?: Date | null;

  approved_sha256?: string;

  approved_on?: Date;
}
