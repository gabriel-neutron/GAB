// The layers of the arcs, from the bottom. The canvas draws them and the legend reads them, so the
// two cannot differ.

export interface ArcLayer {
  readonly id: string;
  readonly style: string;
  /** The property that gives the width, or a fixed width. */
  readonly width: 'width' | 'halo' | number;
  readonly dash: number[] | null;
  readonly colour: 'product' | 'review' | 'land';
  readonly opacity: number;
}

// An estimate is hatched over a pale halo of its range,
// and a capacity is a hollow line: a line of the land inside a line of the product.
export const ARC_LAYERS: readonly ArcLayer[] = [
  {
    id: 'arcs-halo',
    style: 'estimated',
    width: 'halo',
    dash: null,
    colour: 'product',
    opacity: 0.25,
  },
  { id: 'arcs-solid', style: 'solid', width: 'width', dash: null, colour: 'product', opacity: 1 },
  {
    id: 'arcs-dashed',
    style: 'dashed',
    width: 'width',
    dash: [3, 2],
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-review',
    style: 'in review',
    width: 'width',
    dash: [0.5, 1.5],
    colour: 'review',
    opacity: 1,
  },
  {
    id: 'arcs-observed',
    style: 'observed',
    width: 'width',
    dash: null,
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-estimated',
    style: 'estimated',
    width: 'width',
    dash: [1, 1],
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-capacity',
    style: 'capacity',
    width: 'width',
    dash: null,
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-capacity-inside',
    style: 'capacity',
    width: 1.5,
    dash: null,
    colour: 'land',
    opacity: 1,
  },
];
