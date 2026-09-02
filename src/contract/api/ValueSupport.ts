import { z } from 'zod';

export default interface ValueSupport {
  owner_kind: string | null;

  owner_id: string | null;

  owner_label: string | null;

  doc_id: string | null;

  attr_key: string | null;

  key_label: string | null;

  kind: string | null;

  unit: string | null;

  value: unknown;
}

export const valueSupport = z.object({
  owner_kind: z.string().nullable(),
  owner_id: z.uuid().nullable(),
  owner_label: z.string().nullable(),
  doc_id: z.string().nullable(),
  attr_key: z.string().nullable(),
  key_label: z.string().nullable(),
  kind: z.string().nullable(),
  unit: z.string().nullable(),
  value: z.unknown(),
});
