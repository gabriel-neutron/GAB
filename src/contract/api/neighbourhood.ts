export interface neighbourhood_params {
  root: string;

  depth?: number;
}

export interface neighbourhood_return_type {
  entity_id: string | null;

  hop: number | null;
}
