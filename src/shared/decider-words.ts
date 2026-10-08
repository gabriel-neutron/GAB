import type { DecisionMode } from './read/model';

const RULE_ORIGIN = /^rule ([a-z_]+) v(\d+)(?: |$)/u;

/** Who or what decided an act, in words, from the mode and the origin that the record keeps. A
 * rule is named with its version. Only the operator validates manually, so an older decision with
 * no origin reads as manual too. */
export const deciderWords = (
  mode: DecisionMode | null,
  origin: string | null,
  verdict: 'accepted' | 'rejected',
): string => {
  const rule = origin === null ? null : RULE_ORIGIN.exec(origin);
  const name = rule?.[1];
  const version = rule?.[2];
  if (name !== undefined && version !== undefined)
    return `${verdict} by the rule ${name.replaceAll('_', ' ')}, version ${version}`;
  if (mode === 'rule') return `${verdict} by a rule`;
  if (origin === 'decided by an AI reviewer') return origin;
  return mode === 'group'
    ? 'validated manually by the operator, group action'
    : 'validated manually by the operator';
};
