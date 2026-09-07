/** Identifier type for public.parameter */
export type ParameterKey = string & { __brand: 'public.parameter' };

export default interface Parameter {
  key: ParameterKey;

  value: string;
}

export interface ParameterInitializer {
  key: ParameterKey;

  value: string;
}

export interface ParameterMutator {
  key?: ParameterKey;

  value?: string;
}
