import { nameHoldsQuery } from '@/shared/name-match';

import type { Subject } from './queue';

export const subjectsNamed = (subjects: readonly Subject[], query: string): readonly Subject[] =>
  subjects.filter((subject) => nameHoldsQuery(subject.label, query));
