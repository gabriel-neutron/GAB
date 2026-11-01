export function itemAt<T>(items: ArrayLike<T>, index: number): T {
  const value = items[index];
  if (value === undefined) throw new Error(`Missing report item ${index}`);
  return value;
}
export interface ReportNode {
  id: string;
  name: string;
  type: string;
  description: string;
  record?: string;
  lat?: number | null;
  lon?: number | null;
  basis?: string;
  source?: string;
  docs?: string;
}
export interface ReportRelation {
  from: string;
  to: string;
  kind: string;
  docs?: string;
  ref: number;
}
