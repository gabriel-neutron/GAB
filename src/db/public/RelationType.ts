/** Identifier type for public.relation_type */
export type RelationTypeKey = string & { __brand: 'public.relation_type' };

export default interface RelationType {
  key: RelationTypeKey;

  label: string;

  inverse_label: string;

  takes_interval: boolean;

  retired: boolean;

  created_at: Date;
}

export interface RelationTypeInitializer {
  key: RelationTypeKey;

  label: string;

  inverse_label: string;

  takes_interval?: boolean;

  retired?: boolean;

  created_at?: Date;
}

export interface RelationTypeMutator {
  key?: RelationTypeKey;

  label?: string;

  inverse_label?: string;

  takes_interval?: boolean;

  retired?: boolean;

  created_at?: Date;
}
