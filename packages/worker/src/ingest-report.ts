import type { IngestOutcome } from './ingest.ts';

interface NoTextEntry {
  readonly path: string;
  readonly id: string;
  readonly pageCount: number;
}

interface PartialTextEntry extends NoTextEntry {
  readonly emptyPages: readonly number[];
}

interface PairFile {
  readonly path: string;
  readonly id: string;
  readonly sha256: string;
}

interface NearCopies {
  readonly stem: string;
  readonly files: readonly PairFile[];
}

/** What a run found in the files it took. A dry run carries the same fields. */
interface IngestReport {
  readonly dryRun: boolean;
  readonly counts: { readonly stored: number; readonly known: number; readonly refused: number };
  readonly noTextLayer: readonly NoTextEntry[];
  readonly partialText: readonly PartialTextEntry[];
  readonly nearCopies: readonly NearCopies[];
  readonly refused: readonly { readonly path: string; readonly reason: string }[];
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
};

const baseOf = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/** The title without what a copy adds: the extension, a trailing ` (1)` or `_compressed`. */
export const titleStem = (path: string): string => {
  const name = baseOf(path);
  let stem = (extensionOf(name) === '' ? name : name.slice(0, name.lastIndexOf('.'))).toLowerCase();
  for (;;) {
    const next = stem
      .replace(/\s*\(\d+\)$/, '')
      .replace(/[\s_-]+compressed$/, '')
      .trim();
    if (next === stem) break;
    stem = next;
  }
  return stem.replace(/\s+/g, ' ');
};

const isPdf = (path: string): boolean => extensionOf(baseOf(path)) === '.pdf';

// Departure: a pair needs the same extension as well as the same stem. A report that sits beside
// its own data export under one stem is not a copy of it, and a corpus holds many such files.
const pairsOf = (taken: readonly IngestOutcome[]): NearCopies[] => {
  const seen = new Set<string>();
  const groups = new Map<string, { stem: string; files: PairFile[] }>();
  for (const outcome of taken) {
    const { sha256, id } = outcome;
    if (sha256 === undefined || id === undefined || seen.has(sha256)) continue;
    seen.add(sha256);
    const stem = titleStem(outcome.path);
    const key = `${stem}\u0000${extensionOf(baseOf(outcome.path))}`;
    const group = groups.get(key) ?? { stem, files: [] };
    group.files.push({ path: outcome.path, id, sha256 });
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.files.length > 1);
};

/** The report of a run, from the outcome of each file. It reads and writes nothing. */
export const buildReport = (outcomes: readonly IngestOutcome[], dryRun: boolean): IngestReport => {
  const stored = outcomes.filter((outcome) => outcome.status === 'stored');
  const noTextLayer: NoTextEntry[] = [];
  const partialText: PartialTextEntry[] = [];
  for (const outcome of stored) {
    const { id, pageCount } = outcome;
    if (!isPdf(outcome.path) || id === undefined || pageCount === undefined) continue;
    const emptyPages = outcome.emptyPages ?? [];
    if (emptyPages.length === pageCount) noTextLayer.push({ path: outcome.path, id, pageCount });
    else if (emptyPages.length > 0)
      partialText.push({ path: outcome.path, id, pageCount, emptyPages });
  }
  const refused = outcomes.flatMap((outcome) =>
    outcome.status === 'refused'
      ? [{ path: outcome.path, reason: outcome.reason ?? 'the file was not taken' }]
      : [],
  );
  return {
    dryRun,
    counts: {
      stored: stored.length,
      known: outcomes.filter((outcome) => outcome.status === 'known').length,
      refused: refused.length,
    },
    noTextLayer,
    partialText,
    nearCopies: pairsOf(outcomes.filter((outcome) => outcome.status !== 'refused')),
    refused,
  };
};

/** The lines that the terminal shows after the line of each file. */
export const summaryLines = (report: IngestReport): string[] => {
  const { stored, known, refused } = report.counts;
  const lines = [
    '',
    report.dryRun
      ? `Dry run, nothing was written: would store ${stored}, known ${known}, refused ${refused}`
      : `Run report: stored ${stored}, known ${known}, refused ${refused}`,
  ];
  const verb = report.dryRun ? 'would be stored' : 'stored';
  if (report.noTextLayer.length > 0) {
    lines.push(`PDFs with no text layer on any page (${verb}):`);
    for (const entry of report.noTextLayer) lines.push(`  ${entry.path}  ${entry.pageCount} pages`);
  }
  if (report.partialText.length > 0) {
    lines.push('PDFs with no text on some pages:');
    for (const entry of report.partialText)
      lines.push(`  ${entry.path}  no text on pages ${entry.emptyPages.join(', ')}`);
  }
  if (report.nearCopies.length > 0) {
    lines.push('Files with one title stem and different bytes (they stay separate documents):');
    for (const pair of report.nearCopies)
      lines.push(`  ${pair.stem}: ${pair.files.map((file) => file.path).join('  |  ')}`);
  }
  return lines;
};
