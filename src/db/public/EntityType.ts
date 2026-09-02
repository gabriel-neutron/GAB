/** Identifier type for public.entity_type */
export type EntityTypeKey = string & { __brand: 'public.entity_type' };

export default interface EntityType {
  key: EntityTypeKey;

  label: string;

  colour_light: string;

  colour_dark: string;

  ord: number;

  retired: boolean;

  created_at: Date;
}

export interface EntityTypeInitializer {
  key: EntityTypeKey;

  label: string;

  colour_light: string;

  colour_dark: string;

  ord?: number;

  retired?: boolean;

  created_at?: Date;
}

export interface EntityTypeMutator {
  key?: EntityTypeKey;

  label?: string;

  colour_light?: string;

  colour_dark?: string;

  ord?: number;

  retired?: boolean;

  created_at?: Date;
}
