import type { Coverage } from '@gab/release/coverage';
import { releaseDay } from '@gab/release/release-day';

export interface CoverageStatementProps {
  readonly coverage: Coverage;
  /** The version and the day of the release that the counts come from, or null for the live record. */
  readonly release: { readonly version: string; readonly date: string } | null;
}

const count = (n: number, noun: string): string => `${n} ${noun}`;

/** What the record covers: the counts by type and of sources, then the fixed words of its scope
 * and the meaning of an absence. */
export function CoverageStatement({ coverage, release }: CoverageStatementProps) {
  const { scope } = coverage;
  return (
    <div className="flex max-w-prose flex-col gap-2">
      <p>
        {release === null
          ? 'The record holds '
          : `Release ${release.version} of ${releaseDay(release.date)} holds `}
        {count(coverage.entities, coverage.entities === 1 ? 'entity' : 'entities')} and cites{' '}
        {count(coverage.sources, coverage.sources === 1 ? 'source' : 'sources')}.
      </p>
      {coverage.byType.length === 0 ? null : (
        <p className="text-label">
          By type: {coverage.byType.map((one) => `${one.count} ${one.type}`).join(', ')}.
        </p>
      )}
      <p>{scope.covers}</p>
      <p>{scope.excludes}</p>
      <p className="font-semibold">{scope.absence}</p>
    </div>
  );
}
