import { z } from "zod";
import { DisciplineSchema } from "./discipline.js";
import { IsoWeekSchema } from "./week.js";

export const DISTANCE_MIN_KM = 0.01;
export const DISTANCE_MAX_KM = 1000;

/**
 * One triathlon training session. Unlike lifts, sessions are append-only: a
 * user can log as many bike/swim/run sessions per week as they like, so the
 * unique key is (user_id, logged_at) rather than (iso_week, user_id, lift).
 * Velocity (km/h) is not stored — it is derived from distance and time.
 */
export const TriathlonEntrySchema = z.object({
  iso_week: IsoWeekSchema,
  week_start: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  discipline: DisciplineSchema,
  distance_km: z.number().min(DISTANCE_MIN_KM).max(DISTANCE_MAX_KM),
  duration_seconds: z.number().int().positive(),
  logged_at: z.string().min(1),
});
export type TriathlonEntry = z.infer<typeof TriathlonEntrySchema>;

/** Average velocity in km/h, derived from distance and elapsed time. */
export function velocityKmh(entry: TriathlonEntry): number {
  return entry.distance_km / (entry.duration_seconds / 3600);
}

/** Descending sort by logged_at (newest first). Safe lexically — ISO timestamps. */
export function descLoggedAt(a: TriathlonEntry, b: TriathlonEntry): number {
  return b.logged_at.localeCompare(a.logged_at);
}

/** Render whole seconds as `H:MM:SS` (hours omitted when zero, e.g. `52:30`). */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return hours > 0 ? `${String(hours)}:${mm}:${ss}` : `${mm}:${ss}`;
}
