/** Identifier type for public.evidence_word */
export type EvidenceWordVersion = number & { __brand: 'public.evidence_word' };

/** Identifier type for public.evidence_word */
export type EvidenceWordLang = string & { __brand: 'public.evidence_word' };

/** Identifier type for public.evidence_word */
export type EvidenceWordCueKind = string & { __brand: 'public.evidence_word' };

/** Identifier type for public.evidence_word */
export type EvidenceWordWord = string & { __brand: 'public.evidence_word' };

export default interface EvidenceWord {
  version: EvidenceWordVersion;

  lang: EvidenceWordLang;

  cue_kind: EvidenceWordCueKind;

  word: EvidenceWordWord;
}

export interface EvidenceWordInitializer {
  version: EvidenceWordVersion;

  lang: EvidenceWordLang;

  cue_kind: EvidenceWordCueKind;

  word: EvidenceWordWord;
}

export interface EvidenceWordMutator {
  version?: EvidenceWordVersion;

  lang?: EvidenceWordLang;

  cue_kind?: EvidenceWordCueKind;

  word?: EvidenceWordWord;
}
