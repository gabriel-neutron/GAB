// The two values that mark an act of the v1 import (#13). The import is done and its script is
// deleted, but the record keeps its acts, and the database reserves these values: the batch door
// gives the originator only to an item that cites the stored v1 ORBAT, and the review names the
// proposer "v1 import". The tests that write such an act read the values here.

/** The party that each act of the v1 import names. The review reads it to name the proposer. */
export const V1_ORIGINATOR = 'GAB v1 ORBAT (operator)';
/** The title of the stored v1 ORBAT. The batch door reserves the originator to an item that cites it. */
export const V1_TITLE = 'GAB v1 ORBAT: military units and organisations of the v1 GeoPackage';
