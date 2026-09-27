import type { Pool } from 'pg';

// A pool and one client of it both answer here. The lock a claim takes lasts as long as the
// transaction of the connection that took it, so which connection asks is the whole question.
export type Queryable = Pick<Pool, 'query'>;
