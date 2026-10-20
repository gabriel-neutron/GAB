import { elementsOf } from '@gab/release/value-elements';

import type { Attributes } from '@/shared/read/model';

/** The identity of a vessel at the head of its page and its panel. Null is a value that the
 * record does not hold. */
export interface VesselIdentity {
  readonly flag: string | null;
  readonly mmsi: string | null;
  readonly callSign: string | null;
}

// A history lists its values in the order of the record, so its last element is the current one.
function current(attrs: Attributes, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = attrs[key]?.v;
    if (value === undefined) continue;
    const listed: readonly (string | number)[] =
      typeof value === 'string'
        ? elementsOf(value)
        : typeof value === 'number' || typeof value === 'boolean'
          ? [String(value)]
          : value;
    const elements = listed.map((one) => String(one).trim()).filter((one) => one !== '');
    const last = elements.at(-1);
    if (last !== undefined) return last;
  }
  return null;
}

/** The flag, the MMSI and the call sign of a vessel, or null for an entity that is no vessel.
 * `openFlag` is the flag state of the newest `flags` relation with no end date. It is the weaker
 * source: an attribute wins. */
export function vesselIdentity(
  type: string,
  attrs: Attributes,
  openFlag: string | null,
): VesselIdentity | null {
  if (type !== 'vessel') return null;
  return {
    flag: current(attrs, ['flag', 'flag_history']) ?? openFlag,
    mmsi: current(attrs, ['mmsi_history', 'mmsi']),
    callSign: current(attrs, ['call_sign']),
  };
}
