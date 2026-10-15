import { relationWords } from '@gab/proposal/relation-types';

import { attributeName } from './attribute-name.ts';
import { NO_STAGE_COLOUR, stageOf, STAGES, type StageKey } from './chain-stage.ts';
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

/** A fact is accepted when its label does not say that it is only proposed. */
export const isAccepted = (originLabel: string): boolean => !originLabel.startsWith('Proposed');

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

/** The data of the chain view: the stage of each entity with a position, and its card. The data
 * comes from the claims of the release, which holds accepted facts only. */
export interface ChainView {
  readonly stages: ReadonlyMap<string, StageKey | null>;
  readonly cards: Readonly<Record<string, Card>>;
  readonly counts: ReadonlyMap<StageKey, number>;
}

/** The GeoJSON of the release with the stage and its colour added to each feature. The file of the
 * release itself does not change. */
export const stagedGeojson = (release: SiteRelease, view: ChainView): string => {
  const collection = JSON.parse(release.geojson) as {
    features: { id: string; properties: object }[];
  };
  for (const feature of collection.features) {
    const stage = view.stages.get(feature.id) ?? null;
    feature.properties = {
      ...feature.properties,
      stage: STAGES.find((one) => one.key === stage)?.label ?? '',
      colour: STAGES.find((one) => one.key === stage)?.colour ?? NO_STAGE_COLOUR,
    };
  }
  return JSON.stringify(collection);
};

export const chainView = (release: SiteRelease): ChainView => {
  const stages = new Map<string, StageKey | null>();
  const cards: Record<string, Card> = {};
  const counts = new Map<StageKey, number>();
  for (const feature of mapFeatures(release.geojson)) {
    const entity = release.entityById.get(feature.id);
    const known = release.claimsAbout.get(feature.id) ?? [];
    const claims = known.filter((one) => isAccepted(one.originLabel));
    const values = claims.filter((one) => one.kind === 'attribute');
    const kind = values.find((one) => one.attribute === 'asset_kind')?.value;
    const stage =
      entity !== undefined && !isAccepted(entity.originLabel) ? null : stageOf(feature.type, kind);
    stages.set(feature.id, stage);
    if (stage !== null) counts.set(stage, (counts.get(stage) ?? 0) + 1);
    cards[feature.id] = {
      label: feature.label,
      type: feature.type,
      stage: STAGES.find((one) => one.key === stage)?.label ?? '',
      href: hrefFrom(MAP, entityPage(feature.id)),
      inReview:
        known.length -
        claims.length +
        (stage === null && entity !== undefined && !isAccepted(entity.originLabel) ? 1 : 0),
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
