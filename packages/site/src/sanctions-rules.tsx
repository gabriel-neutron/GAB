import type { SiteManifest } from './site-manifest.ts';

const RULE_WORDS: Readonly<Record<string, string>> = {
  entry_into_force: 'the date of entry into force of the act',
  recent_actions_notice: 'the date of the Recent Actions notice',
  date_designated: 'the date designated',
};

/** How a card reads the sanctions of an asset, and the date rules of the release. The map and the
 * Method page give the same text. */
export function SanctionsRules({ manifest }: { readonly manifest: SiteManifest }) {
  const rules = manifest.dateRules;
  return (
    <>
      <p>
        A facility or a port has a status for each regime (EU, US, UK). “Listed in” is a listing in
        an act. “Sectoral measure” is a sectoral restriction, not an asset freeze. A measure that
        names the asset has a full edge. A measure that names its direct operator or owner, and not
        the asset, has a dotted edge and the name of that operator or owner. Only a current
        operating or ownership link counts, and the map gives no share. The map does not apply the
        50% rule. “No measure found in this release” tells only what this release holds.
      </p>
      <p data-date-rules="">
        {rules === null
          ? 'This release does not give its date rules.'
          : `Date rules of this release, for the alignment matrix. EU: ${RULE_WORDS[rules.eu] ?? rules.eu}. US: ${RULE_WORDS[rules.ofac] ?? rules.ofac}. UK: ${RULE_WORDS[rules.uk] ?? rules.uk}.`}{' '}
        On the map, a measure gives its start date in the record. With no start, it gives the entry
        into force of its act, when that value cites a file of the same regime. Else it shows “date
        not in release”.
      </p>
    </>
  );
}
