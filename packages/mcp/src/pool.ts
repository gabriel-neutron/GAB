import pg from 'pg';

/** A pool whose lost connection never ends the process. */
export const openPool = (config: pg.PoolConfig): pg.Pool => {
  const pool = new pg.Pool(config);
  const log = (fault: Error): void => {
    console.error(fault);
  };
  pool.on('error', log);
  // External constraint: pg removes the listener of the pool from a client at each checkout, and an
  // 'error' event with no listener stops the process. The call then fails on its next statement.
  pool.on('connect', (client) => {
    client.on('error', log);
  });
  return pool;
};
