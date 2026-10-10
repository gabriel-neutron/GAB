import type { ReleaseManifest } from './release-manifest.ts';

/** What each file of a release says about the release before its data. */
export interface ReleaseHeading {
  readonly version: string;
  /** The day of the release, ISO 8601. */
  readonly date: string;
  /** The name of the dataset with its version and its day. */
  readonly title: string;
  /** The disclaimer with the two contact addresses. */
  readonly disclaimer: string;
}

const dayOfRelease = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
};

/** The heading of the files of a release. */
export const releaseHeading = (manifest: ReleaseManifest, disclaimer: string): ReleaseHeading => ({
  version: manifest.version,
  date: manifest.date,
  title: `GAB dataset, version ${manifest.version} of ${dayOfRelease(manifest.date)}.`,
  disclaimer,
});
