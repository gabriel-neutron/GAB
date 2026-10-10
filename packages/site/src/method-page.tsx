import { DisclaimerText } from './disclaimer-text.tsx';
import { SiteFrame } from './site-frame.tsx';
import { METHOD } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';

const SECTION = 'flex max-w-prose flex-col gap-2';

/** The method page: the disclaimer with the meaning of each label, the licences, the rule of the
 * critical nodes, the permanent addresses and the rating method. The NATO pair is explained only
 * when the release shows it. */
export function MethodPage({ release }: { readonly release: SiteRelease }) {
  const { manifest } = release;
  return (
    <SiteFrame release={release} page={{ path: METHOD, title: 'Method' }}>
      <section className={SECTION}>
        <h2 className="font-medium">About this data and the labels</h2>
        <DisclaimerText markdown={manifest.disclaimer} />
      </section>

      <section className={SECTION}>
        <h2 className="font-medium">The rating method</h2>
        <p>
          GAB rates each source and each fact apart. Each author of a source gets a rating of its
          reliability, from its record and from a reference set of authors that experts wrote. Each
          fact gets a rating of its credibility, from the number of independent authors that give it
          and from the conflicts between its sources. The rules accept a claim only from strong
          sources, and a claim that the rules cannot decide waits for the operator.
        </p>
        {manifest.showNatoPair ? (
          <p data-nato-pair="">
            This release shows the NATO pair of each claim (STANAG 2511). The letter, from A
            (reliable) to F (cannot be judged), is the best rating among the authors whose sources
            support the fact. It rates the author, never the fact. The digit, from 1 (confirmed by
            independent sources) to 6 (cannot be judged), rates the credibility of the fact. It
            never reads a letter. A claim with no digit or with no known author shows no pair.
          </p>
        ) : (
          <p>This release does not show the rating of a claim.</p>
        )}
      </section>

      <section className={SECTION}>
        <h2 className="font-medium">Licences</h2>
        <p>
          The dataset is under CC-BY 4.0. Each row takes the most permissive licence of its public
          documents: CC-BY 4.0, CC-BY-NC 4.0, or "derived fact; source under the provider licence,
          not redistributed". A row with the last text gives a fact that GAB read in a source, and
          the release does not give the source data again.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className="font-medium">The critical nodes</h2>
        <p>
          A node is retained when it meets two conditions of three. Condition (a) comes from the
          public designations of the node itself. The operator ticks conditions (b) and (c) with the
          claims that support each tick, and the release refuses a tick that cites a claim that is
          not public. The release does not check that a claim supports its condition: that is the
          judgement of the operator. A tick with no public claim shows "not sourced".
        </p>
      </section>

      <section className={SECTION}>
        <h2 className="font-medium">Permanent addresses</h2>
        <p>
          Each entity and each claim has a permanent address under{' '}
          <span className="font-mono break-all">{manifest.iriBase}</span>, the same identifier as in
          the linked data file. The address of an entity that a merge absorbed opens the entity that
          replaces it.
        </p>
      </section>
    </SiteFrame>
  );
}
