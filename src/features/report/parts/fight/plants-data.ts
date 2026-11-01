import plantsRaw from '../../data/atlas-plants.csv?raw';
import { readCsv } from '../../line-panel';
import type { Place } from './chain-data';

/** The Russian defence plants and integrators that receive foreign components, as the data file
 * gives them. A plant with no position has no point on a map. */
export const plants = readCsv(plantsRaw);

/** The glyph of each main weapon, 10 px wide, centred on the point. */
export const GLYPH: Readonly<Record<string, string>> = {
  drone: 'M0,-5L5,4H-5Z',
  'cruise missile': 'M0,-5L5,0L0,5L-5,0Z',
  'ballistic missile': 'M0,-5L5,0L0,5L-5,0Z',
  'guided bomb': 'M-4,-4H4V4H-4Z',
  armour: 'M-5,-3H5V3H-5Z',
  aircraft: 'M-5,3L0,-4L5,3L0,0Z',
};
// The most specific weapon of a plant gives its glyph: a drone plant with other lines shows as a drone.
const PRIORITY = [
  'drone',
  'cruise missile',
  'ballistic missile',
  'guided bomb',
  'aircraft',
  'armour',
];

/** The weapon types of a plant, as the data file lists them. */
export const weaponsOf = (plant: Record<string, string>) =>
  (plant['weapon_type'] ?? '')
    .split(/[;,]/)
    .map((type) => type.trim())
    .filter((type) => type !== '');

/** The glyph key of a plant: its most specific weapon, or `other`. */
export const glyphOf = (plant: Record<string, string>) => {
  const types = weaponsOf(plant);
  return PRIORITY.find((type) => types.includes(type)) ?? 'other';
};

/** The six main plants that a map names. */
export const LABELS = ['Alabuga SEZ', 'IEMZ Kupol', 'KTRV', 'STC', 'Kalashnikov', 'Uralvagonzavod'];

const hasPoint = (plant: Record<string, string>) => plant['lat'] !== '' && plant['lon'] !== '';

export interface PlantMark {
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  readonly glyph: string;
  /** The position is a lead, not a stored position: the map draws it hollow. */
  readonly approximate: boolean;
}

/** The plants that have a point, in the order of the data file. */
export const plantMarks: readonly PlantMark[] = plants.filter(hasPoint).map((plant) => ({
  name: plant['entity'] ?? '',
  lon: Number(plant['lon']),
  lat: Number(plant['lat']),
  glyph: glyphOf(plant),
  approximate: plant['position_basis'] === 'lead',
}));

/** The six main plants as labelled places of the chain map. */
export const mainPlants: readonly Place[] = LABELS.flatMap((label) => {
  const plant = plants.find((one) => (one['entity'] ?? '').startsWith(label) && hasPoint(one));
  return plant === undefined
    ? []
    : [
        {
          name: (plant['entity'] ?? '').split(' (')[0] ?? '',
          lon: Number(plant['lon']),
          lat: Number(plant['lat']),
          side: 'right' as const,
          tone: 'ink' as const,
        },
      ];
});
