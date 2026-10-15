/** The volume of one physical link for the reference month. The volume table gives it. */
export interface ArcVolume {
  readonly amount: number;
  readonly unit: string;
  readonly month: string;
}

/** How the map draws one arc: a line width in pixels and a line style. */
export interface ArcLine {
  readonly width: number;
  readonly style: 'solid' | 'dashed' | 'in review';
}

/** The line of an arc. A link in review has its own style, so the map never draws it as a fact.
 * A link after the export stage is dashed. The width does not use the volume yet: each arc has the
 * same width until the volume table gives the volumes. */
export const arcLine = (arc: {
  readonly afterExport: boolean;
  readonly inReview: boolean;
  readonly volume: ArcVolume | null;
}): ArcLine => ({
  width: 2,
  style: arc.inReview ? 'in review' : arc.afterExport ? 'dashed' : 'solid',
});
