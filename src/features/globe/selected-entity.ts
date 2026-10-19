import type { GlobeState } from './globe-store';

/** The entity that the card is about, or null. A link or an exit point is not an entity of the
 * record, so it gives null. */
export const selectedEntity = (state: GlobeState): string | null =>
  state.panel.kind === 'target' && state.panel.target.kind === 'entity'
    ? state.panel.target.id
    : null;
