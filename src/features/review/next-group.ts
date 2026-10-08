/** The group that the page opens after a group action: the next group of the rail, or the group
 * before it when it was the last. The rail is the one that the screen showed before the action,
 * so the order does not move under the operator. Null where the rail holds no other group. */
export function nextGroup(rail: readonly { readonly id: string }[], acted: string): string | null {
  const at = rail.findIndex((line) => line.id === acted);
  if (at === -1) return rail[0]?.id ?? null;
  return rail[at + 1]?.id ?? rail[at - 1]?.id ?? null;
}
