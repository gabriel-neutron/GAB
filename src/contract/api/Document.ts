import { z } from 'zod';

export default interface Document {
  id: string | null;

  kind: string | null;

  title: string | null;

  uri: string | null;

  archive_uri: string | null;

  sha256: string | null;

  mime: string | null;

  retrieved_at: string | null;

  admiralty: string | null;

  admiralty_origin: string | null;

  created_at: string | null;
}

export const document = z.object({
  id: z.string().nullable(),
  kind: z.string().nullable(),
  title: z.string().nullable(),
  uri: z.string().nullable(),
  archive_uri: z.string().nullable(),
  sha256: z.string().nullable(),
  mime: z.string().nullable(),
  retrieved_at: z.string().nullable(),
  admiralty: z.string().nullable(),
  admiralty_origin: z.string().nullable(),
  created_at: z.string().nullable(),
});
