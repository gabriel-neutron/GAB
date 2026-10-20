export interface ChoosableEntity {
  readonly id: string;
  readonly label: string;
  readonly degree: number;
}

interface StartChoices {
  readonly shown: readonly ChoosableEntity[];
  /** How many entities match. It is larger than `shown` when the list is cut. */
  readonly total: number;
}

/**
 * The entities the graph offers as a place to start. The caller sorts them with the most
 * connected first, so an empty field offers the hubs and a text keeps that order.
 */
export function startChoices(
  named: readonly ChoosableEntity[],
  text: string,
  limit: number,
): StartChoices {
  const needle = text.trim().toLowerCase();
  const matching =
    needle === '' ? named : named.filter((row) => row.label.toLowerCase().includes(needle));
  return { shown: matching.slice(0, limit), total: matching.length };
}
