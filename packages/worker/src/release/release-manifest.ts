import { z } from 'zod';

/** The manifest is refused. The message names the value to correct. */
export class ReleaseManifestFault extends Error {}

// A contact link opens a page or a mail program from any copy of the files, so it is a full
// address on https or mailto.
const contact = z
  .string()
  .trim()
  .refine((value) => /^(https:\/\/\S+|mailto:\S+@\S+)$/u.test(value), {
    message: 'give an https:// or a mailto: address',
  });

const day = z.iso.date();

const shape = z.strictObject({
  version: z.string().trim().min(1).optional(),
  date: day.optional(),
  showNatoPair: z.boolean().default(false),
  dateRules: z
    .strictObject({
      eu: z.enum(['entry_into_force']).default('entry_into_force'),
      ofac: z.enum(['recent_actions_notice']).default('recent_actions_notice'),
      uk: z.enum(['date_designated']).default('date_designated'),
    })
    .prefault({}),
  contacts: z.strictObject({ reportError: contact, rightOfReply: contact }),
  criticalNodes: z.string().trim().min(1).nullable().default(null),
});

/** What the operator gives for one release. Each value has a default, except the two contact
 * addresses of the disclaimer. */
export interface ReleaseManifest {
  readonly version: string;
  /** The day of the release, YYYY-MM-DD. */
  readonly date: string;
  /** Always false: no file shows the NATO pair of a claim yet. */
  readonly showNatoPair: false;
  /** The date that counts for a listing of each regime. */
  readonly dateRules: {
    readonly eu: 'entry_into_force';
    readonly ofac: 'recent_actions_notice';
    readonly uk: 'date_designated';
  };
  readonly contacts: { readonly reportError: string; readonly rightOfReply: string };
  /** The sheet of the candidate nodes, or null. */
  readonly criticalNodes: string | null;
}

const said = (error: z.ZodError): string =>
  error.issues
    .map(
      (issue) =>
        `${issue.path.length === 0 ? 'the manifest' : issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ');

/** Reads the text of a release manifest. The date of the release is the UTC day of `now` when
 * the manifest gives none, and the version is the date when it gives none. */
export const readReleaseManifest = (text: string, now: Date): ReleaseManifest => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ReleaseManifestFault('The release manifest is not valid JSON.');
  }
  const read = shape.safeParse(json);
  if (!read.success)
    throw new ReleaseManifestFault(`The release manifest is refused. ${said(read.error)}.`);
  const { version, date, showNatoPair, ...rest } = read.data;
  // The release shows the pair only when the operator changes S1, and no code builds it yet.
  if (showNatoPair)
    throw new ReleaseManifestFault(
      'The release manifest asks to show the NATO pair, and this release cannot show it yet. ' +
        'Remove showNatoPair or set it to false.',
    );
  const released = date ?? now.toISOString().slice(0, 10);
  return { version: version ?? released, date: released, showNatoPair, ...rest };
};
