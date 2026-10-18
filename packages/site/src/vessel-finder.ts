/** The address of the page of a vessel on VesselFinder, an external viewer, from its IMO number. */
export const vesselFinderUrl = (imo: string): string =>
  `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(imo)}`;
