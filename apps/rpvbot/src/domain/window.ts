import { format, fromZonedTime, toZonedTime } from "date-fns-tz";

export interface DayWindow {
  /** UTC ISO instant, inclusive lower bound. */
  readonly startUtc: string;
  /** UTC ISO instant, exclusive upper bound. */
  readonly endUtc: string;
  /** `YYYY-MM-DD` of the day, in the configured time zone. */
  readonly label: string;
}

/**
 * Calendar-day window for "yesterday" in the given time zone. DST-safe:
 * we convert "now" into the zone, derive the wall-clock day before, then
 * convert the 00:00/24:00 wall-clock boundaries back to UTC instants via
 * `fromZonedTime` so spring-forward / fall-back days have the correct
 * 23h or 25h length.
 */
export function previousCalendarDayBounds(
  now: Date,
  timeZone: string,
): DayWindow {
  const zonedNow = toZonedTime(now, timeZone);
  const yesterdayZoned = new Date(
    zonedNow.getFullYear(),
    zonedNow.getMonth(),
    zonedNow.getDate() - 1,
  );
  const label = format(yesterdayZoned, "yyyy-MM-dd", { timeZone });

  const startUtc = fromZonedTime(`${label} 00:00:00.000`, timeZone);
  const nextDayLabel = format(
    new Date(
      yesterdayZoned.getFullYear(),
      yesterdayZoned.getMonth(),
      yesterdayZoned.getDate() + 1,
    ),
    "yyyy-MM-dd",
    { timeZone },
  );
  const endUtc = fromZonedTime(`${nextDayLabel} 00:00:00.000`, timeZone);

  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
    label,
  };
}
