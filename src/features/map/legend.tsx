import { FAMILY_DASH, FAMILY_LABEL, EVERY_FAMILY, familyOfLink } from './map-tokens';
import type { GeoLink } from './projection';

/** The legend of the relation lines, at the top left of the canvas: the families the record holds. */
export function FamilyLegend({ links }: { readonly links: readonly GeoLink[] }) {
  const counts = new Map<string, number>();
  for (const link of links) {
    const family = familyOfLink(link.type);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  const present = EVERY_FAMILY.filter((family) => counts.has(family));
  if (present.length === 0) return null;
  return (
    <ul
      aria-label="Relation families"
      className="absolute top-2 left-2 z-10 hidden w-52 flex-col gap-1 rounded-sm border border-border bg-surface p-2 text-data md:flex"
    >
      {present.map((family) => {
        const dash = FAMILY_DASH[family];
        return (
          <li key={family} className="flex items-center gap-2">
            <svg aria-hidden="true" width="14" height="2" className="shrink-0">
              <line
                x1="0"
                y1="1"
                x2="14"
                y2="1"
                stroke={`var(--relation-${family})`}
                strokeWidth="1.5"
                strokeDasharray={dash[1] === 0 ? undefined : dash.join(' ')}
              />
            </svg>
            <span className="min-w-0 flex-1">{FAMILY_LABEL[family]}</span>
            <span className="font-mono tabular-nums">{counts.get(family)}</span>
          </li>
        );
      })}
    </ul>
  );
}
