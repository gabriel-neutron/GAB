export const nameHoldsQuery = (name: string, query: string): boolean =>
  name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
