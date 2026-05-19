import { toZonedTime } from "date-fns-tz";

/** True iff `now`, viewed in `timeZone`, falls on a Friday. */
export function isFriday(now: Date, timeZone: string): boolean {
  const zoned = toZonedTime(now, timeZone);
  return zoned.getDay() === 5;
}

export type SummaryLanguage = "en" | "es";

/**
 * Friday in the configured time zone → English (aligned with
 * los_piratas_bot's "English Friday"). Every other day → Spanish.
 */
export function summaryLanguage(now: Date, timeZone: string): SummaryLanguage {
  return isFriday(now, timeZone) ? "en" : "es";
}
