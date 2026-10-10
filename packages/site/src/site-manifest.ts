import { z } from 'zod';

const counts = z.object({
  added: z.number().int(),
  changed: z.number().int(),
  removed: z.number().int(),
  merged: z.number().int(),
  unmerged: z.number().int(),
});

/** The shape of the file manifest of a release, as the site reads it. */
export const siteManifestShape = z.object({
  version: z.string(),
  date: z.iso.date(),
  showNatoPair: z.boolean(),
  disclaimer: z.string(),
  contacts: z.object({ reportError: z.string(), rightOfReply: z.string() }),
  iriBase: z.string(),
  changelog: z.object({
    path: z.string(),
    previous: z.object({ version: z.string(), date: z.iso.date() }).nullable(),
    entities: counts,
    relations: counts,
    claims: counts,
  }),
  files: z.array(
    z.object({
      path: z.string().regex(/^[\w-][\w.-]*$/u),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    }),
  ),
});

/** The file manifest of a release: its version, its day, the parameter of the NATO pair, the
 * disclaimer, the contact addresses, the base of the identifiers, the changelog summary and the
 * checksum of each file. */
export type SiteManifest = z.output<typeof siteManifestShape>;

/** The number of changes of one kind since the previous release. */
export type ChangeCounts = z.output<typeof counts>;
