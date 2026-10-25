import { z } from 'zod';

export default interface Observation {
  id: string | null;

  measure: string | null;

  value: number | null;

  unit: string | null;

  period: string | null;

  method: string | null;

  publisher: string | null;

  reporter_system: string | null;

  reporter: string | null;

  partner_system: string | null;

  partner: string | null;

  product_system: string | null;

  product: string | null;

  subject_id: string | null;

  licence: string | null;

  flag: string | null;

  document_id: string | null;

  page: number | null;

  span_start: number | null;

  span_end: number | null;

  mapping_id: string | null;

  created_at: string | null;
}

export const observation = z.object({
  id: z.uuid().nullable(),
  measure: z.string().nullable(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  period: z.string().nullable(),
  method: z.string().nullable(),
  publisher: z.string().nullable(),
  reporter_system: z.string().nullable(),
  reporter: z.string().nullable(),
  partner_system: z.string().nullable(),
  partner: z.string().nullable(),
  product_system: z.string().nullable(),
  product: z.string().nullable(),
  subject_id: z.uuid().nullable(),
  licence: z.string().nullable(),
  flag: z.string().nullable(),
  document_id: z.string().nullable(),
  page: z.number().nullable(),
  span_start: z.number().nullable(),
  span_end: z.number().nullable(),
  mapping_id: z.uuid().nullable(),
  created_at: z.string().nullable(),
});
