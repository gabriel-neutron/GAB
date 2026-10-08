import type { DecisionMode } from './read/model';

// The origin of a rule decision is "rule <name> v<version>", and the inputs of the rule may follow.
const RULE_NAMES: readonly string[] = ['impossible', 'doubt', 'strong_sources', 'weak_sources'];

const ruleOf = (origin: string | null): string | null => {
  const [kind, name, tag] = (origin ?? '').split(' ');
  const version = tag?.startsWith('v') ? Number(tag.slice(1)) : Number.NaN;
  if (kind !== 'rule' || name === undefined || !RULE_NAMES.includes(name)) return null;
  return Number.isInteger(version)
    ? `the rule ${name.replaceAll('_', ' ')}, version ${version}`
    : null;
};

/** The origin that the record keeps for a decision of an AI reviewer. */
const AI_REVIEWER = 'decided by an AI reviewer';

/** Who or what decided an act, in words, from the mode and the origin that the record keeps. A
 * rule is named with its version. An AI reviewer is named, and the words say that no human
 * decided. Only the operator validates manually, so an older decision with no origin reads as
 * manual too. */
export const deciderWords = (
  mode: DecisionMode | null,
  origin: string | null,
  verdict: 'accepted' | 'rejected',
): string => {
  const rule = ruleOf(origin);
  if (rule !== null) return `${verdict} by ${rule}`;
  if (mode === 'rule') return `${verdict} by a rule`;
  if (origin === AI_REVIEWER) return `${AI_REVIEWER} and not by a human`;
  return mode === 'group'
    ? 'validated manually by the operator, group action'
    : 'validated manually by the operator';
};
