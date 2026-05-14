import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getISOWeek, getISOWeekYear, startOfISOWeek } from "date-fns";
import { z } from "zod";

export const IsoWeekSchema = z.string().regex(/^\d{4}-W\d{2}$/);
export type IsoWeek = z.infer<typeof IsoWeekSchema>;

export function currentIsoWeek(now: Date, timeZone: string): IsoWeek {
  const zoned = toZonedTime(now, timeZone);
  const year = getISOWeekYear(zoned);
  const week = getISOWeek(zoned);
  const padded = week.toString().padStart(2, "0");
  return IsoWeekSchema.parse(`${year}-W${padded}`);
}

export function currentWeekStart(now: Date, timeZone: string): string {
  const zoned = toZonedTime(now, timeZone);
  const monday = startOfISOWeek(zoned);
  return format(monday, "yyyy-MM-dd");
}
