import { parseLift, type Lift } from "./lifts.js";

const BODYWEIGHT_ALIASES = new Set(["bodyweight", "bw"]);

export type Target = { kind: "lift"; lift: Lift } | { kind: "bodyweight" };

export function parseTarget(arg: string): Target | undefined {
  const normalized = arg.trim().toLowerCase();
  if (BODYWEIGHT_ALIASES.has(normalized)) return { kind: "bodyweight" };
  const lift = parseLift(normalized);
  return lift === undefined ? undefined : { kind: "lift", lift };
}

/** Descending ISO-week sort (newest first). Lexical compare is safe because the format is YYYY-Www. */
export function descIsoWeek<T extends { iso_week: string }>(
  a: T,
  b: T,
): number {
  return b.iso_week.localeCompare(a.iso_week);
}
