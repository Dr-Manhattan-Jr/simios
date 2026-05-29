import { z } from "zod";

export const DisciplineSchema = z.enum(["bike", "swim", "run"]);
export type Discipline = z.infer<typeof DisciplineSchema>;

export const ALL_DISCIPLINES: ReadonlyArray<Discipline> =
  DisciplineSchema.options;

/**
 * Parse a user-typed triathlon discipline. Case-insensitive, but no aliases or
 * partial matches — anything not exactly one of DisciplineSchema.options is
 * rejected, mirroring parseLift.
 */
export function parseDiscipline(input: string): Discipline | undefined {
  const normalized = input.trim().toLowerCase();
  const result = DisciplineSchema.safeParse(normalized);
  return result.success ? result.data : undefined;
}
