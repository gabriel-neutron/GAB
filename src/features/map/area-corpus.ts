import { corpus } from '@/shared/committed-fixture/corpus';
import { toDomain } from '@/shared/read/map';
import type { Corpus, Entity } from '@/shared/read/model';

export const POLYGON_ID = '5a1c0e72-8d3b-4f46-9a21-6b7c8d9e0f11';
export const MULTIPOLYGON_ID = '6b2d1f83-9e4c-4a57-8b32-7c8d9e0f1a22';

const area = (id: string, label: string, geom: unknown): readonly [Entity, unknown] => [
  {
    id,
    type: 'facility',
    proposedType: null,
    label,
    attrs: {},
    sources: ['doc_8f2a41'],
    geom: null,
    promotedFrom: 'b2c1d4e5-0900-4a11-9c33-77e1f2a3b4c5',
  },
  { id, type: 'facility', label, geom, position_precision: null, parent_id: null },
];

// An invented single-point mooring area beside the berth of the committed corpus, and a pair of
// invented anchorage areas far from every point. The corpus itself is not changed.
const AREAS = [
  area(POLYGON_ID, 'Invented mooring area', {
    type: 'Polygon',
    coordinates: [
      [
        [4.02, 51.94],
        [4.06, 51.94],
        [4.06, 51.97],
        [4.02, 51.97],
        [4.02, 51.94],
      ],
    ],
  }),
  area(MULTIPOLYGON_ID, 'Invented anchorage areas', {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [24.0, 59.5],
          [24.3, 59.5],
          [24.3, 59.7],
          [24.0, 59.7],
          [24.0, 59.5],
        ],
      ],
      [
        [
          [24.6, 59.5],
          [24.8, 59.5],
          [24.8, 59.6],
          [24.6, 59.6],
          [24.6, 59.5],
        ],
      ],
    ],
  }),
] as const;

/** The committed corpus with two entities that a polygon locates. */
export const areaCorpus: Corpus = {
  ...corpus,
  entities: [...corpus.entities, ...AREAS.map(([entity]) => entity)],
  positions: [...corpus.positions, ...AREAS.map(([, row]) => toDomain.mapPosition(row))],
};
