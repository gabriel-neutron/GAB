import { z } from 'zod';

// The method of geolocation says how a source found the place of an entity. The list is closed:
// the database holds the same words in a CHECK, and a new word is a new migration, as for the
// type of a document. `not_stated` is a true value: no source of the place says how it
// was found. The words of the list are the keys that a file of the release carries.

export const GEOLOCATION_METHODS = [
  'register_address',
  'osm_object',
  'operator_statement',
  'satellite_match',
  'photo_video_match',
  'source_coordinates',
  'not_stated',
] as const;

export type GeolocationMethod = (typeof GEOLOCATION_METHODS)[number];

/** The method that an entity holds when no source of its place says how the place was found. */
export const NOT_STATED: GeolocationMethod = 'not_stated';

/** The key of the method in the payload of an act and in a row of an entity. */
export const GEOLOCATION_KEY = 'geom_method';

export const geolocationMethod = z.enum(GEOLOCATION_METHODS, {
  error: `the method of geolocation is one of ${GEOLOCATION_METHODS.join(', ')}`,
});

/** The words that tell a reader what each method means. */
export const GEOLOCATION_WORDS: Readonly<Record<GeolocationMethod, string>> = {
  register_address: 'the address of a register entry',
  osm_object: 'an OpenStreetMap object',
  operator_statement: 'a statement of the operator of the site',
  satellite_match: 'a match with satellite imagery',
  photo_video_match: 'a match with a photo or a video',
  source_coordinates: 'coordinates that the source writes',
  not_stated: 'not stated',
};

/** True when the value is a method of the list. */
export const isGeolocationMethod = (value: unknown): value is GeolocationMethod =>
  geolocationMethod.safeParse(value).success;
