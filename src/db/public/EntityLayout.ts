import type { EntitiesId } from './Entities';

export default interface EntityLayout {
  entity_id: EntitiesId;

  x: number;

  y: number;

  computed_at: Date;
}

export interface EntityLayoutInitializer {
  entity_id: EntitiesId;

  x: number;

  y: number;

  computed_at?: Date;
}

export interface EntityLayoutMutator {
  entity_id?: EntitiesId;

  x?: number;

  y?: number;

  computed_at?: Date;
}
