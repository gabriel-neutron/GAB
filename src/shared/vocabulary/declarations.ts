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
    entityType('vessel', 'Vessel', '#2971c6', '#70adfb', 10),
    entityType('facility', 'Facility', '#007989', '#00c2d2', 20),
    entityType('company', 'Company', '#007d50', '#53c48e', 30),
    entityType('person', 'Person', '#677000', '#a8b44b', 40),
    entityType('military_unit', 'Military unit', '#8254c4', '#b7a0e4', 50),
    entityType('port', 'Port', '#a16100', '#df9b44', 60),
    entityType('bank', 'Bank', '#b53c7f', '#e887b6', 70),
    // A ministry, an agency, a regulator or a council of a state or of a union of states. A central
    // bank stays `bank`.
    entityType('state_body', 'State body', '#b2432a', '#f28c6c', 75),
    entityType('legal_act', 'Legal act', '#8b598e', '#e889ed', 80),
    // `unknown` takes the grey and sorts last: a grey says that no type was recognised.
    entityType('unknown', 'Unknown', '#6b7280', '#9ca3af', 900),
  ],
};
