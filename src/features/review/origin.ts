/** Who wrote an act. An agent writes as one role and the operator as the other, and the record
 * keeps the role. A confidence of the operator is not a self-report of the machine. */

import type { AuthorRole } from '@/shared/read/model';

export type Origin = 'machine' | 'operator';

const ORIGIN_OF: Readonly<Record<AuthorRole, Origin>> = {
  gabriel_agent: 'machine',
  gabriel_research: 'machine',
  gabriel_app: 'operator',
};

export const originOf = (role: AuthorRole): Origin => ORIGIN_OF[role];
