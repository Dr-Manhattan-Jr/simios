import { z } from "zod";

export const LiftSchema = z.enum([
  "bench",
  "squat",
  "deadlift",
  "clean_and_jerk",
  "snatch",
]);
export type Lift = z.infer<typeof LiftSchema>;

export const ALL_LIFTS: ReadonlyArray<Lift> = LiftSchema.options;

export const REQUIRED_LIFTS: ReadonlyArray<Lift> = [
  "bench",
  "squat",
  "deadlift",
];

export const OPTIONAL_LIFTS: ReadonlyArray<Lift> = [
  "clean_and_jerk",
  "snatch",
];

export function isRequired(lift: Lift): boolean {
  return REQUIRED_LIFTS.includes(lift);
}

/**
 * Parse a user-typed lift name. Case-insensitive, but no aliases or partial
 * matches — anything not exactly one of LiftSchema.options is rejected.
 */
export function parseLift(input: string): Lift | undefined {
  const normalized = input.trim().toLowerCase();
  const result = LiftSchema.safeParse(normalized);
  return result.success ? result.data : undefined;
}
