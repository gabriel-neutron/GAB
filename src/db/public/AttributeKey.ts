/** Identifier type for public.attribute_key */
export type AttributeKeyKey = string & { __brand: 'public.attribute_key' };

export default interface AttributeKey {
  key: AttributeKeyKey;

  stem: string;

  kind: string;

  label: string;

  unit: string | null;

  pattern: string | null;

  retired: boolean;

  created_at: Date;
}

export interface AttributeKeyInitializer {
  key: AttributeKeyKey;

  stem: string;

  kind: string;

  label: string;

  unit?: string | null;

  pattern?: string | null;

  retired?: boolean;

  created_at?: Date;
}

export interface AttributeKeyMutator {
  key?: AttributeKeyKey;

  stem?: string;

  kind?: string;

  label?: string;

  unit?: string | null;

  pattern?: string | null;

  retired?: boolean;

  created_at?: Date;
}
