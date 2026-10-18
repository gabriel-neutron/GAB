import type { ReactNode } from 'react';

import type { Card } from './chain-card.ts';
import { STAGES, type StageKey } from './chain-stage.ts';
import { LINK } from './site-style.ts';

const IN_REVIEW = 'In review';

// A fact in review never takes the form of an accepted fact: it carries a tag in words, a dashed
// edge and the muted text.
const ACCEPTED_ITEM = 'border-l border-border pl-1.5';
const REVIEW_ITEM = 'border-l-2 border-dashed border-candidate pl-1.5 text-muted-foreground';

function Fact({
  inReview,
  label,
  children,
}: {
  readonly inReview: boolean;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <li className={inReview ? REVIEW_ITEM : ACCEPTED_ITEM} title={label}>
      {inReview ? <span className="mr-1 text-small/4 text-candidate">{IN_REVIEW}</span> : null}
      {children}
    </li>
  );
}

function Section({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="mt-2 text-label">{heading}</h3>
      {children}
    </section>
  );
}

const interval = (from: string, to: string): string =>
  from === '' && to === '' ? '' : ` (${from === '' ? 'no start stored' : from} to ${to})`;

/** The card of one entity of the map: its stage, its sanctions status for each regime, the strikes
 * at the site, its values and its relations. Each fact in review is marked in words. The stage is
 * the stage that the strip and the table give: a declared destination replaces the asset kind. */
export function AssetCard({
  card,
  stage,
}: {
  readonly card: Card;
  readonly stage: StageKey | null;
}) {
  const stageLabel = STAGES.find((one) => one.key === stage)?.label ?? '';
  return (
    <article className="flex flex-col gap-1" aria-label={`Card of ${card.label}`}>
      <h2 className="font-medium">
        <a className={LINK} href={card.href}>
          {card.label}
        </a>
      </h2>
      <p>{[card.type, stageLabel].filter(Boolean).join(', ')}</p>
      {card.inReview ? (
        <p className="text-candidate">
          {IN_REVIEW}: no rule and no person checked this entity, so each fact below is in review.
        </p>
      ) : null}
      {card.sanctions === null ? null : (
        <Section heading="Sanctions">
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            {card.sanctions.map((regime) => (
              <div key={regime.regime} className="contents">
                <dt className="text-label">{regime.regime}</dt>
                <dd>
                  {regime.measures.length === 0 ? (
                    'No listing.'
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {regime.measures.map((one) => (
                        <Fact key={one.id} inReview={one.inReview} label={one.label}>
                          {one.measure}, act: {one.act === '' ? 'not stored' : one.act}, from{' '}
                          <span className="tabular-nums">
                            {one.from === '' ? 'no date stored' : one.from}
                          </span>
                          {one.to === '' ? '' : ` to ${one.to}`}.
                        </Fact>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {card.strikes.length === 0 ? null : (
        <Section heading="Strikes">
          <ul className="flex flex-col gap-0.5">
            {card.strikes.map((one) => (
              <Fact key={one.id} inReview={one.inReview} label={one.label}>
                {one.days === '' ? (
                  'Reported by '
                ) : (
                  <>
                    <span className="tabular-nums">{one.days}</span>, reported by{' '}
                  </>
                )}
                {one.reportedBy.length === 0 ? 'no stored document' : one.reportedBy.join(', ')}.
              </Fact>
            ))}
          </ul>
        </Section>
      )}
      {card.values.length === 0 ? null : (
        <Section heading="Values">
          <ul className="flex flex-col gap-0.5">
            {card.values.map((one) => (
              <Fact key={one.id} inReview={one.inReview} label={one.label}>
                {one.key}: {one.value}
              </Fact>
            ))}
          </ul>
        </Section>
      )}
      {card.relations.length === 0 ? null : (
        <Section heading="Relations">
          <ul className="flex flex-col gap-0.5">
            {card.relations.map((one) => (
              <Fact key={one.id} inReview={one.inReview} label={one.label}>
                {one.words}{' '}
                <a className={LINK} href={one.otherHref}>
                  {one.otherLabel}
                </a>
                {interval(one.from, one.to)}
              </Fact>
            ))}
          </ul>
        </Section>
      )}
      <p className="mt-2">Sources and events: see the page of the entity.</p>
    </article>
  );
}
