import { relationWords } from '@gab/proposal/relation-types';

import { attributeName } from './attribute-name.ts';
import { isAccepted } from './accepted.ts';
import { stageOf, STAGES, type StageKey } from './chain-stage.ts';
import { mapFeatures } from './map-features.ts';
import type { SiteRelease } from './site-release.ts';
import { entityPage, hrefFrom, MAP } from './site-paths.ts';

/** One fact of a card, with the label that tells who decided it. */
export interface CardValue {
  readonly key: string;
  readonly value: string;
  readonly label: string;
}

/** One relation of a card. The dates are the interval of the relation, as the release gives it. */
export interface CardRelation {
  readonly words: string;
  readonly otherLabel: string;
  readonly otherHref: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface CardValue {
  readonly key: string;
  readonly value: string;
  readonly label: string;
}

/** One relation of a card. The dates are the interval of the relation, as the release gives it. */
export interface CardRelation {
  readonly words: string;
  readonly otherLabel: string;
  readonly otherHref: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface Card {
  readonly label: string;
  readonly type: string;
  readonly stage: string;
  readonly href: string;
  readonly values: readonly CardValue[];
  readonly relations: readonly CardRelation[];
  /** The count of facts that the card does not show, because they are still in review. */
  readonly inReview: number;
}

/** The data of the chain view: the stage of each entity with a position, and its card. A card
 * shows accepted facts only. The release also holds proposals, and a card counts them. */
export interface ChainView {
  readonly stages: ReadonlyMap<string, StageKey | null>;
  readonly cards: Readonly<Record<string, Card>>;
  readonly counts: ReadonlyMap<StageKey, number>;
}

export const chainView = (release: SiteRelease): ChainView => {
  const stages = new Map<string, StageKey | null>();
  const cards: Record<string, Card> = {};
  const counts = new Map<StageKey, number>();
  for (const feature of mapFeatures(release.geojson)) {
    const entity = release.entityById.get(feature.id);
    const entityInReview = entity === undefined || !isAccepted(entity.originLabel);
    const known = release.claimsAbout.get(feature.id) ?? [];
    // A proposed entity shows no fact: its facts hang on an entity that no one has checked.
    const claims = entityInReview ? [] : known.filter((one) => isAccepted(one.originLabel));
    const values = claims.filter((one) => one.kind === 'attribute');
    const kind = values.find((one) => one.attribute === 'asset_kind')?.value;
    const stage = entityInReview ? null : stageOf(feature.type, kind);
    stages.set(feature.id, stage);
    if (stage !== null) counts.set(stage, (counts.get(stage) ?? 0) + 1);
    cards[feature.id] = {
      label: feature.label,
      type: feature.type,
      stage: STAGES.find((one) => one.key === stage)?.label ?? '',
      href: hrefFrom(MAP, entityPage(feature.id)),
      inReview: known.length - claims.length + (entityInReview ? 1 : 0),
      values: values.map((one) => ({
        key: attributeName(one.attribute),
        value: one.value,
        label: one.originLabel,
      })),
      relations: claims.flatMap((one) => {
        if (one.kind !== 'relation') return [];
        const { relation } = one;
        const fromHere = relation.fromId === feature.id;
        const otherId = fromHere ? relation.toId : relation.fromId;
        return [
          {
            words: relationWords(relation.type, !fromHere),
            otherLabel: fromHere ? relation.toLabel : relation.fromLabel,
            otherHref: hrefFrom(MAP, entityPage(otherId)),
            from: relation.validFrom ?? '',
            to: relation.validTo ?? '',
            label: one.originLabel,
          },
        ];
      }),
    };
  }
  return { stages, cards, counts };
};
