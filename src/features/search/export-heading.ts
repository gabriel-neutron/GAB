/** The release that a saved selection names: its version, its day and its disclaimer. */
export interface HeadingRelease {
  readonly version: string;
  readonly date: string;
  readonly disclaimer: string;
}

/** The lines that a saved selection holds before its rows. A file that leaves the site keeps the
 * licence and the disclaimer of the dataset, and it says where the label of each value is. A
 * live read is no release, and its file says so. */
export const exportHeading = (release: HeadingRelease | null, live: boolean): readonly string[] => [
  live || release === null
    ? 'GAB dataset, a selection of the live record. It is not a release.'
    : `GAB dataset, a selection of the release ${release.version} of ${release.date}.`,
  'Licence: CC-BY 4.0.',
  'The file holds no label. The page of each entity gives the label of each value: who decided it, and the documents that state it.',
  ...(release === null ? [] : [release.disclaimer]),
];
