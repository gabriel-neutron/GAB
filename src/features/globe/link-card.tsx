import { PRODUCTS } from '@gab/proposal/chain-product';

import { READING_LINK } from '@/shared/page/reading-link';

import type { ArcInfo, ExitInfo } from './globe-data';

// The card of a physical link and the card of an exit point are one job: the two targets of the
// globe that are not an entity of the record.
export function ArcCard({ arc }: { readonly arc: ArcInfo }) {
  const product = PRODUCTS.find((one) => one.key === arc.product)?.label ?? '';
  return (
    <article className="flex flex-col gap-1 p-2" aria-label={`Card of the link ${arc.label}`}>
      <h2 className="font-medium">{arc.label}</h2>
      <p>Physical link, {product.toLowerCase()}.</p>
      {arc.inReview ? (
        <p className="text-candidate">
          In review: the link is a proposal, not a fact, and so is each volume below.
        </p>
      ) : null}
      {arc.volumes.length === 0 ? (
        <p>The volume table of this release has no row for this link.</p>
      ) : (
        arc.volumes.map((line) => (
          <div key={`${line.text}${line.source}`} className="flex flex-col gap-0.5">
            <p>{line.text}</p>
            <p className="text-muted-foreground">
              {line.href === null ? (
                line.source
              ) : (
                <a className={READING_LINK} href={line.href} rel="noreferrer">
                  {line.source}
                </a>
              )}
            </p>
          </div>
        ))
      )}
    </article>
  );
}

export function ExitCard({ exit }: { readonly exit: ExitInfo }) {
  return (
    <article
      className="flex flex-col gap-1 p-2"
      aria-label={`Card of the exit point ${exit.label}`}
    >
      <h2 className="font-medium">{exit.label}</h2>
      {exit.inReview ? (
        <p className="text-candidate">
          In review: this exit point rests on a proposal, not a fact.
        </p>
      ) : null}
      <p>
        Exit from Russian control. The release computes this point from its relations: it is not an
        entity of the record.
      </p>
      <p>{exit.why}</p>
    </article>
  );
}
