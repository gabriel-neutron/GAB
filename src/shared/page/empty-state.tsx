export interface EmptyStateProps {
  /** One sentence that says what is absent and why. */
  readonly sentence: string;
}

/** The place of a list or a table that has no row. */
export function EmptyState({ sentence }: EmptyStateProps) {
  return <p className="text-muted-foreground">{sentence}</p>;
}
