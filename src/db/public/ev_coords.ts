export interface ev_coords_params {
  p_text: string;
}

export interface ev_coords_return_type {
  literal: string | null;

  lat: string | null;

  lon: string | null;

  lat_places: number | null;

  lon_places: number | null;

  form: string | null;
}
