/** The elements of a value: a list in its JSON text gives each element, and any other text gives
 * itself. */
export const elementsOf = (value: string): readonly string[] => {
  if (!value.startsWith('[')) return [value];
  try {
    const list: unknown = JSON.parse(value);
    if (Array.isArray(list))
      return list.flatMap((one) =>
        typeof one === 'string' || typeof one === 'number' ? [String(one)] : [],
      );
  } catch {
    // A text that only starts like a list is one value.
  }
  return [value];
};
