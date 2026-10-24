import { RAIL_WIDTH } from '@/shared/rail-width';
import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'map';

/** The rail of the map, kept between two visits as the rail of the graph is. */
export interface MapWorkspace {
  readonly railOpen: boolean;
  /** The width of the open rail, in pixels. The rail clamps it where it draws it. */
  readonly railWidth: number;
}

export const DEFAULT_MAP_WORKSPACE: MapWorkspace = { railOpen: true, railWidth: RAIL_WIDTH.min };

const DECLARED = { railOpen: true, railWidth: true } as const;

const isWorkspace = (value: unknown): value is MapWorkspace =>
  holdsOnlyDeclaredKeys(value, DECLARED) &&
  typeof value['railOpen'] === 'boolean' &&
  typeof value['railWidth'] === 'number' &&
  Number.isFinite(value['railWidth']);

export const readMapWorkspace = (): MapWorkspace =>
  readWorkspace(FEATURE, isWorkspace, DEFAULT_MAP_WORKSPACE);

export function patchMapWorkspace(patch: Partial<MapWorkspace>): MapWorkspace {
  const next = { ...readMapWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}
