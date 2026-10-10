import { attributeName } from './attribute-name.ts';
import { claimText } from './claim-text.ts';
import { NatoPairMark } from './nato-pair-mark.tsx';
import { relationWords } from './relation-words.ts';
import { SiteFrame } from './site-frame.tsx';
import { claimPage, entityPage, hrefFrom } from './site-paths.ts';
import type { SiteClaim, SiteRelease, SiteSource } from './site-release.ts';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';
import { SourceList } from './source-list.tsx';

export interface EntityPageProps {
  readonly release: SiteRelease;
  readonly entityId: string;
}

/** The page of one public entity: its type, its label and licence, each value with its claim,
 * each relation that starts or ends at it with its claim, and the documents of these claims. */
export function EntityPage({ release, entityId }: EntityPageProps) {
  const entity = release.entityById.get(entityId);
  if (entity === undefined) throw new Error(`the release has no entity ${entityId}`);
  const here = entityPage(entity.id);
  const claims = release.claimsAbout.get(entity.id) ?? [];
  const values = claims.filter((one) => one.kind === 'attribute');
  const relations = claims.filter((one) => one.kind === 'relation');
  const merged = [...release.aliases].filter(([, survivor]) => survivor === entity.id);

  // Each document once, in the order of the claims.
  const sources = new Map<string, SiteSource>();
  for (const claim of claims)
    for (const source of claim.sources)
      if (!sources.has(source.documentId)) sources.set(source.documentId, source);

  const claimCell = (claim: SiteClaim) => (
    <td className={CELL}>
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <a
          className={LINK}
          href={hrefFrom(here, claimPage(claim.id))}
          aria-label={`Claim: ${claimText(claim)}`}
        >
          Claim
        </a>
        <NatoPairMark pair={claim.pair} />
      </span>
    </td>
  );

  return (
    <SiteFrame release={release} page={{ path: here, title: entity.label }}>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <dt className="text-label">Type</dt>
        <dd>{entity.type}</dd>
        <dt className="text-label">Identifier</dt>
        <dd className="font-mono">{entity.id}</dd>
        <dt className="text-label">Label</dt>
        <dd>{entity.originLabel}</dd>
        <dt className="text-label">Licence</dt>
        <dd>{entity.licence}</dd>
        <dt className="text-label">Permanent address</dt>
        <dd className="font-mono break-all">{`${release.manifest.iriBase}entity/${entity.id}`}</dd>
        {merged.length === 0 ? null : (
          <>
            <dt className="text-label">Merged identifiers</dt>
            <dd className="font-mono">
              {merged.map(([absorbed]) => (
                <p key={absorbed}>{absorbed}</p>
              ))}
            </dd>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Values</h2>
        {values.length === 0 ? (
          <p>The release holds no value of this entity.</p>
        ) : (
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={HEAD}>Key</th>
                <th className={HEAD}>Value</th>
                <th className={HEAD}>Label</th>
                <th className={HEAD}>Claim</th>
              </tr>
            </thead>
            <tbody>
              {values.map((claim) => (
                <tr key={claim.id} className="border-b border-border">
                  <td className={CELL}>{attributeName(claim.attribute)}</td>
                  <td className={CELL}>{claim.value}</td>
                  <td className={CELL}>{claim.originLabel}</td>
                  {claimCell(claim)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Relations</h2>
        {relations.length === 0 ? (
          <p>The release holds no relation of this entity.</p>
        ) : (
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={HEAD}>Relation</th>
                <th className={HEAD}>Other end</th>
                <th className={HEAD}>From</th>
                <th className={HEAD}>To</th>
                <th className={HEAD}>Label</th>
                <th className={HEAD}>Claim</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((claim) => {
                const { relation } = claim;
                const fromHere = relation.fromId === entity.id;
                const otherId = fromHere ? relation.toId : relation.fromId;
                const otherLabel = fromHere ? relation.toLabel : relation.fromLabel;
                return (
                  <tr key={claim.id} className="border-b border-border">
                    <td className={CELL}>{relationWords(relation.type, !fromHere)}</td>
                    <td className={CELL}>
                      <a className={LINK} href={hrefFrom(here, entityPage(otherId))}>
                        {otherLabel}
                      </a>
                    </td>
                    <td className={`${CELL} font-mono tabular-nums`}>{relation.validFrom}</td>
                    <td className={`${CELL} font-mono tabular-nums`}>{relation.validTo}</td>
                    <td className={CELL}>{claim.originLabel}</td>
                    {claimCell(claim)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Sources</h2>
        <SourceList sources={[...sources.values()]} withPassages={false} />
      </section>
    </SiteFrame>
  );
}
