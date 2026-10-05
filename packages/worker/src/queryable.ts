// A pool and one client of it both answer here, and so does a test that holds no server. The lock a
// claim takes lasts as long as the transaction of the connection that took it, so which
// connection asks is the whole question.
export interface Queryable {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
}
