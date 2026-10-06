import { z } from 'zod';

export default interface OriginatorCard {
  id: string | null;

  display_name: string | null;

  kind: string | null;

  imprint_id: string | null;

  party: string | null;

  sanctioned_controlled: boolean | null;

  sanctions: unknown;

  letter_origin: string | null;

  n_resolved: number | null;

  n_true: number | null;

  n_fabricated: number | null;

  resolved_claims: unknown;
}

export const originatorCard = z.object({
  id: z.string().nullable(),
  display_name: z.string().nullable(),
  kind: z.string().nullable(),
  imprint_id: z.string().nullable(),
  party: z.string().nullable(),
  sanctioned_controlled: z.boolean().nullable(),
  sanctions: z.unknown(),
  letter_origin: z.string().nullable(),
  n_resolved: z.number().nullable(),
  n_true: z.number().nullable(),
  n_fabricated: z.number().nullable(),
  resolved_claims: z.unknown(),
});
