/** Identifier type for public.family_probe_run */
export type FamilyProbeRunId = string & { __brand: 'public.family_probe_run' };

export default interface FamilyProbeRun {
  id: FamilyProbeRunId;

  prompt_set_version: string;

  model_a: string;

  model_b: string;

  prompts: number;

  matches: number;

  threshold: string | null;

  passed: boolean;

  run_at: Date;
}

export interface FamilyProbeRunInitializer {
  id?: FamilyProbeRunId;

  prompt_set_version: string;

  model_a: string;

  model_b: string;

  prompts: number;

  matches: number;

  threshold?: string | null;

  passed: boolean;

  run_at?: Date;
}

export interface FamilyProbeRunMutator {
  id?: FamilyProbeRunId;

  prompt_set_version?: string;

  model_a?: string;

  model_b?: string;

  prompts?: number;

  matches?: number;

  threshold?: string | null;

  passed?: boolean;

  run_at?: Date;
}
