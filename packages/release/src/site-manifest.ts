import { day } from '@gab/proposal/day';
import { z } from 'zod';

import { coverageShape, geolocationCoverageShape, natoCoverageShape } from './coverage.ts';

const counts = z.object({
  added: z.number().int(),
  changed: z.number().int(),
  removed: z.number().int(),
  merged: z.number().int(),
  unmerged: z.number().int(),
});

// The release refuses any other contact address, so a copy that holds one was changed.
const contact = z.string().regex(/^(https:\/\/\S+|mailto:\S+@\S+)$/u);

/** The shape of the file manifest of a release, as the site reads it. */
export const siteManifestShape = z.object({
  version: z.string(),
  date: day,
  showNatoPair: z.boolean(),
  // A release before the date rules on the site has no member.
  dateRules: z
    .object({
      eu: z.literal('entry_into_force'),
      ofac: z.literal('recent_actions_notice'),
      uk: z.literal('date_designated'),
    })
    .nullable()
    .default(null),
  disclaimer: z.string(),
  contacts: z.object({ reportError: contact, rightOfReply: contact }),
  iriBase: z.string(),
  changelog: z.object({
    path: z.string(),
    previous: z.object({ version: z.string(), date: day }).nullable(),
    entities: counts,
    relations: counts,
    claims: counts,
  }),
  nameCandidates: z.object({
    proposed: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    refused: z.number().int().nonnegative(),
  }),
  // A release before the coverage statement has no member.
  coverage: coverageShape.nullable().default(null),
  // A release that does not show the pair, and a release before the statement, have no member.
  natoCoverage: natoCoverageShape.nullable().optional(),
  // A release before the statement of the methods of geolocation has no member.
  geolocationCoverage: geolocationCoverageShape.nullable().optional(),
  files: z.array(
    z.object({
      path: z.string().regex(/^[\w-][\w.-]*$/u),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    }),
  ),
});

/** The file manifest of a release: its version, its day, the parameter of the NATO pair, the
 * disclaimer, the contact addresses, the base of the identifiers, the changelog summary, the
 * number of merge candidates across two scripts in each state and the checksum of each file. */
export type SiteManifest = z.output<typeof siteManifestShape>;

/** The number of changes of one kind since the previous release. */
export type ChangeCounts = z.output<typeof counts>;
