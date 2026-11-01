import { useContent } from '../../use-content';
import { ValuesTable } from '../ports-fleet/values-table';
import { ChainMap } from './chain-map';
import { GLYPH, mainPlants, plantMarks, plants, weaponsOf } from './plants-data';

/** The glyph of one weapon, for the legend. */
const Glyph = ({
  glyph,
  hollow = false,
}: {
  readonly glyph: string;
  readonly hollow?: boolean;
}) => (
  <svg
    aria-hidden="true"
    viewBox="-6 -6 12 12"
    className={hollow ? 'size-3 fill-background stroke-foreground' : 'size-3 fill-foreground'}
  >
    {GLYPH[glyph] === undefined ? <circle r={3} /> : <path d={GLYPH[glyph]} />}
  </svg>
);

/** The defence plants on the chain map, by main weapon, with the six main plants named. The
 * points enter once; under reduced motion they show at once. The table gives every plant of the
 * data file, also the plants with no point. */
export function PlantsFigure() {
  const copy = useContent().fightUi.plants;
  const words: Readonly<Record<string, string>> = copy.words;
  const word = (raw: string) => words[raw] ?? raw;
  const rows = plants.map((plant) => [
    plant['entity'] ?? '',
    plant['city'] ?? '',
    weaponsOf(plant).map(word).join(', '),
    word(plant['position_basis'] ?? ''),
    word(plant['eu'] ?? ''),
    word(plant['uk'] ?? ''),
    word(plant['us'] ?? ''),
  ]);
  return (
    <div>
      <div className="relative aspect-[5/2] w-full">
        <ChainMap
          crop="plants"
          places={mainPlants}
          arcs={[]}
          lit={false}
          sites={[]}
          plants={plantMarks}
          label={copy.mapLabel}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-report-label text-label">
        {copy.legend.map(([glyph, text]) => (
          <li key={glyph} className="flex items-center gap-1.5">
            <Glyph glyph={glyph} />
            {text}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <Glyph glyph="other" hollow />
          {copy.approximate}
        </li>
      </ul>
      <ValuesTable summary={copy.table} head={copy.columns} rows={rows} />
    </div>
  );
}
