// The two names that mark the v1 import. The import ran on 7 October 2026 (#13) and its script is
// deleted, but the batch door (db/apply/40_functions.sql) still checks these names, so the tests of
// the queue use them.

/** The party that each act of the v1 import names. The review reads it to name the proposer. */
export const ORIGINATOR = 'GAB v1 ORBAT (operator)';
/** The title of the stored v1 ORBAT. The batch door reserves the originator for an item that cites it. */
export const TITLE = 'GAB v1 ORBAT: military units and organisations of the v1 GeoPackage';
