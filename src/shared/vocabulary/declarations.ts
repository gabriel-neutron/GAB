/** Every entity type the seed writes, and the only place one is declared. An ATTRIBUTE key is
 * declared nowhere: M11 leaves that half of the model with no vocabulary at all. */

/** One row of `entity_type`. `ord` is the print order of a list of types. */
export interface SeededEntityType {
  readonly key: string;
  readonly label: string;
  readonly colourLight: string;
  readonly colourDark: string;
  readonly ord: number;
}

const entityType = (
  key: string,
  label: string,
  colourLight: string,
  colourDark: string,
  ord: number,
): SeededEntityType => ({ key, label, colourLight, colourDark, ord });

export const seededVocabulary: {
  readonly retiredWhenSeeded: boolean;
  readonly entityTypes: readonly SeededEntityType[];
} = {
  // The table defaults `retired` to false and the seed writes no such column, so every seeded
  // word is in service on the day it lands.
  retiredWhenSeeded: false,

  entityTypes: [
    entityType('vessel', 'Vessel', '#1e65aa', '#77b5fb', 10),
    entityType('facility', 'Facility', '#007a69', '#3fcab7', 20),
    entityType('company', 'Company', '#357426', '#87c47a', 30),
    entityType('person', 'Person', '#983f6b', '#eb90b9', 40),
    entityType('military_unit', 'Military unit', '#a03f40', '#f4918e', 50),
    entityType('port', 'Port', '#007491', '#3bc4e0', 60),
    entityType('bank', 'Bank', '#825c00', '#d1ac4e', 70),
    // A ministry, an agency, a regulator or a council of a state or of a union of states. A central
    // bank stays `bank`.
    entityType('state_body', 'State body', '#5d55a9', '#a9a6fa', 75),
    entityType('legal_act', 'Legal act', '#814893', '#d198e3', 80),
    // A dated claim by a party about a site: a claimed strike, a fire, a stoppage. It is not an
    // observed fact, and it has no position. It shares the signal hue on purpose: a claim is live.
    entityType('event', 'Event', '#b8470d', '#ee6018', 85),
    // `unknown` takes the grey and sorts last: a grey says that no type was recognised.
    entityType('unknown', 'Unknown', '#6b6562', '#8a8380', 900),
  ],
};
