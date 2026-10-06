/** Identifier type for public.court_act_cue */
export type CourtActCueVersion = number & { __brand: 'public.court_act_cue' };

/** Identifier type for public.court_act_cue */
export type CourtActCueLang = string & { __brand: 'public.court_act_cue' };

/** Identifier type for public.court_act_cue */
export type CourtActCueCue = string & { __brand: 'public.court_act_cue' };

export default interface CourtActCue {
  version: CourtActCueVersion;

  lang: CourtActCueLang;

  cue: CourtActCueCue;
}

export interface CourtActCueInitializer {
  version: CourtActCueVersion;

  lang: CourtActCueLang;

  cue: CourtActCueCue;
}

export interface CourtActCueMutator {
  version?: CourtActCueVersion;

  lang?: CourtActCueLang;

  cue?: CourtActCueCue;
}
