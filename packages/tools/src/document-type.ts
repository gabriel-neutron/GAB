// The type of a document tells a reader what kind of text a source is. The type comes from the
// provider, the address and the title, in this order, and the first rule that matches decides.
// A document that no rule matches is `other`.

export const DOCUMENT_TYPES = [
  'legal_act',
  'register_entry',
  'press_release',
  'report',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentFacts {
  readonly uri: string | null;
  readonly title: string;
  readonly provider: string | null;
}

/** The host of a web address, in lower case with no "www." in front, or null. */
export const hostOf = (uri: string | null): string | null => {
  if (uri === null) return null;
  const parsed = URL.parse(uri);
  if (parsed === null || parsed.hostname === '') return null;
  return parsed.hostname.toLowerCase().replace(/^www\./u, '');
};

const PROVIDER_TYPES: Readonly<Record<string, DocumentType>> = {
  eu_eurlex: 'legal_act',
  ofac_sdn: 'register_entry',
  uk_sanctions_list: 'register_entry',
};

interface Rule {
  readonly type: DocumentType;
  readonly host?: RegExp;
  readonly address?: RegExp;
  readonly title?: RegExp;
}

// External constraint: the hosts and the paths of the publishers, as they answer on 19 October 2026.
const RULES: readonly Rule[] = [
  {
    type: 'legal_act',
    host: /^(?:eur-lex\.europa\.eu|publications\.europa\.eu|legislation\.gov\.uk|federalregister\.gov|pravo\.gov\.ru|publication\.pravo\.gov\.ru|laws-lois\.justice\.gc\.ca)$/u,
    title:
      /^(?:(?:council|commission)(?: implementing| delegated)? (?:regulation|decision|directive)|executive order|regulation \(|directive \(|the [^.]{0,80}(?:order|regulations) \d{4})\b/iu,
  },
  {
    type: 'register_entry',
    host: /(?:^|\.)(?:opencorporates\.com|gleif\.org|company-information\.service\.gov\.uk|egrul\.nalog\.ru|sanctionslistservice\.ofac\.treas\.gov|opensanctions\.org)$/u,
  },
  {
    type: 'press_release',
    address: /\/(?:press-?releases?|presscorner)(?:\/|$|\?)/iu,
    title: /\bpress release\b/iu,
  },
  {
    type: 'report',
    address: /\/reports?(?:\/|$|\?|-)/iu,
    title: /\b(?:report|annual review|white paper)\b/iu,
  },
];

const matches = (rule: Rule, host: string | null, address: string, title: string): boolean =>
  (host !== null && rule.host?.test(host) === true) ||
  rule.address?.test(address) === true ||
  rule.title?.test(title) === true;

/** The type of a document. */
export const documentType = (facts: DocumentFacts): DocumentType => {
  const byProvider = facts.provider === null ? undefined : PROVIDER_TYPES[facts.provider];
  if (byProvider !== undefined) return byProvider;
  const host = hostOf(facts.uri);
  const address = URL.parse(facts.uri ?? '')?.pathname ?? '';
  return RULES.find((rule) => matches(rule, host, address, facts.title))?.type ?? 'other';
};
