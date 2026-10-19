import { relationWords } from '@gab/proposal/relation-types';
import { CLAIMED_ATTACK } from '@gab/proposal/event-keys';

import { assetSanctions, type AssetMeasure } from './asset-sanctions.ts';
import { attributeName } from './attribute-name.ts';
import { isAccepted, PROPOSED_LABEL } from './accepted.ts';
import { stageOf, type StageKey } from '@gab/proposal/chain-stage';
import { eventsAt } from './event-lane.ts';
import { mapFeatures } from './map-features.ts';
import type { SiteRelease } from './site-release.ts';
import { entityPage, hrefFrom, MAP } from './site-paths.ts';

/** What each fact of a card carries: the label that tells who decided it, and whether it is still
 * in review. A fact in review is a proposal, and the card never shows it as a fact. */
interface CardFact {
  readonly id: string;
  readonly label: string;
  readonly inReview: boolean;
}

export interface CardValue extends CardFact {
  readonly key: string;
  readonly value: string;
}

/** One relation of a card. The dates are the interval of the relation, as the release gives it. */
export interface CardRelation extends CardFact {
  readonly words: string;
  readonly otherId: string;
  readonly otherLabel: string;
  readonly otherHref: string;
  readonly from: string;
  readonly to: string;
}

/** One sanction measure against an asset: the kind of measure, the act, and the dates. */
export interface CardMeasure extends CardFact {
  readonly measure: string;
  /** Empty when the act names the asset. Else the direct operator or owner that the act names,
   * for example "operator KINEF". */
  readonly via: string;
  readonly act: string;
  readonly from: string;
  readonly to: string;
}

/** The measures of one regime. No measure means that the release holds no measure, not that the
 * regime has none. */
export interface CardRegime {
  readonly regime: 'EU' | 'US' | 'UK';
  readonly measures: readonly CardMeasure[];
}

/** One strike that a party claimed at the site, with the documents that report it. */
export interface CardStrike extends CardFact {
  readonly days: string;
  readonly reportedBy: readonly string[];
}

export interface Card {
  readonly label: string;
  readonly type: string;
  readonly href: string;
  /** True when the entity itself is a proposal: then each of its facts is in review. */
  readonly inReview: boolean;
  readonly values: readonly CardValue[];
  readonly relations: readonly CardRelation[];
  /** Null for an entity that has no sanctions status: only a facility or a port has one. */
  readonly sanctions: readonly CardRegime[] | null;
  readonly strikes: readonly CardStrike[];
}

/** The data of the chain view: the stage of the asset kind of each entity with a position, and
 * its card. A card gives the accepted facts first, and then the facts in review, each marked. The
 * flows of the chain give the last stage of an entity, so a card takes its stage from them. */
export interface ChainView {
  readonly stages: ReadonlyMap<string, StageKey | null>;
  readonly cards: Readonly<Record<string, Card>>;
}

const MEASURE_WORDS: Readonly<Record<AssetMeasure['measure'], string>> = {
  designated_by: 'Listed',
  restricted_by: 'Sectoral measure',
};

const REGIMES = [
  ['EU', 'eu'],
  ['US', 'us'],
  ['UK', 'uk'],
] as const;

const acceptedFirst = <T extends CardFact>(facts: readonly T[]): readonly T[] => [
  ...facts.filter((one) => !one.inReview),
  ...facts.filter((one) => one.inReview),
];

export const chainView = (release: SiteRelease): ChainView => {
  const stages = new Map<string, StageKey | null>();
  const cards: Record<string, Card> = {};
  const sanctions = assetSanctions(release.geojson);
  for (const feature of mapFeatures(release.geojson)) {
    const entity = release.entityById.get(feature.id);
    const entityInReview = entity === undefined || !isAccepted(entity.originLabel);
    // A fact of a proposed entity hangs on an entity that no one has checked, so it is in review.
    const fact = (id: string, label: string): CardFact => ({
      id,
      label,
      inReview: entityInReview || !isAccepted(label),
    });
    const claims = release.claimsAbout.get(feature.id) ?? [];
    const values = claims.filter((one) => one.kind === 'attribute');
    const kind = values.find(
      (one) => one.attribute === 'asset_kind' && isAccepted(one.originLabel),
    )?.value;
    const stage = entityInReview ? null : stageOf(feature.type, kind);
    stages.set(feature.id, stage);
    const status = sanctions.get(feature.id);
    cards[feature.id] = {
      label: feature.label,
      type: feature.type,
      href: hrefFrom(MAP, entityPage(feature.id)),
      inReview: entityInReview,
      values: acceptedFirst(
        values.map((one) => ({
          key: attributeName(one.attribute),
          value: one.value,
          ...fact(one.id, one.originLabel),
        })),
      ),
      relations: acceptedFirst(
        claims.flatMap((one) => {
          if (one.kind !== 'relation') return [];
          const { relation } = one;
          const fromHere = relation.fromId === feature.id;
          const otherId = fromHere ? relation.toId : relation.fromId;
          return [
            {
              words: relationWords(relation.type, !fromHere),
              otherId,
              otherLabel: fromHere ? relation.toLabel : relation.fromLabel,
              otherHref: hrefFrom(MAP, entityPage(otherId)),
              from: relation.validFrom ?? '',
              to: relation.validTo ?? '',
              ...fact(one.id, one.originLabel),
            },
          ];
        }),
      ),
      sanctions:
        status === undefined
          ? null
          : REGIMES.map(([regime, key]) => ({
              regime,
              measures: acceptedFirst(
                status[key].map((one) => ({
                  measure: MEASURE_WORDS[one.measure],
                  via: one.via === null ? '' : `${one.via.role} ${one.via.entity_label}`,
                  act: [one.act_label, one.act_document ?? ''].filter(Boolean).join(', '),
                  from: one.from ?? '',
                  to: one.to ?? '',
                  // A measure through an operator or an owner is in review when its link or that entity is.
                  ...fact(
                    `${key} ${one.measure} ${one.act_id} ${one.from ?? ''} ${one.via?.entity_id ?? ''}`.trim(),
                    [
                      one.origin_label,
                      one.via?.link_origin_label ?? one.origin_label,
                      one.via === null
                        ? one.origin_label
                        : (release.entityById.get(one.via.entity_id)?.originLabel ??
                          PROPOSED_LABEL),
                    ].find((label) => !isAccepted(label)) ?? one.origin_label,
                  ),
                })),
              ),
            })),
      strikes: acceptedFirst(
        eventsAt(release, feature.id).flatMap((event) => {
          if (event.kind !== CLAIMED_ATTACK) return [];
          // A strike is in review when the event or its link to the site is a proposal.
          const link = claims.find(
            (one) =>
              one.kind === 'relation' &&
              one.relation.type === 'occurred_at' &&
              one.relation.fromId === event.id,
          );
          const labels = [
            release.entityById.get(event.id)?.originLabel ?? PROPOSED_LABEL,
            link?.originLabel ?? PROPOSED_LABEL,
          ];
          const label = labels.find((one) => !isAccepted(one)) ?? labels[0] ?? PROPOSED_LABEL;
          return [
            {
              days: event.days.join(' to '),
              reportedBy: event.documents.map((one) => one.title),
              ...fact(event.id, label),
            },
          ];
        }),
      ),
    };
  }
  return { stages, cards };
};
