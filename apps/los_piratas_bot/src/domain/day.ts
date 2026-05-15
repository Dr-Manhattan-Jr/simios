import { toZonedTime } from "date-fns-tz";

/** True iff `now`, viewed in `timeZone`, falls on a Friday. */
export function isFriday(now: Date, timeZone: string): boolean {
  const zoned = toZonedTime(now, timeZone);
  return zoned.getDay() === 5;
}
