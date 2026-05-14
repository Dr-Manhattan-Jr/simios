import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import {
  LIFT_WEIGHT_MAX_KG,
  LIFT_WEIGHT_MIN_KG,
  LogEntrySchema,
  type LogEntry,
} from "../domain/log-entry.js";
import { LiftSchema, type Lift } from "../domain/lifts.js";
import { IsoWeekSchema, type IsoWeek } from "../domain/week.js";

export const TAB = "log";
export const HEADER: Row = [
  "iso_week",
  "week_start",
  "user_id",
  "username",
  "lift",
  "weight_kg",
  "made",
  "logged_at",
];

const BoolFromCell = z.preprocess((raw) => {
  if (typeof raw !== "string") return raw;
  const v = raw.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return raw;
}, z.boolean());

const RawRowSchema = z
  .tuple([
    IsoWeekSchema,
    z.string().min(1),
    z.coerce.number().int(),
    z.string(),
    LiftSchema,
    z.coerce.number().min(LIFT_WEIGHT_MIN_KG).max(LIFT_WEIGHT_MAX_KG),
    BoolFromCell,
    z.string().min(1),
  ])
  .transform((cols): LogEntry => {
    const base = {
      iso_week: cols[0],
      week_start: cols[1],
      user_id: cols[2],
      lift: cols[4],
      weight_kg: cols[5],
      made: cols[6],
      logged_at: cols[7],
    };
    return LogEntrySchema.parse(withOptional(base, "username", cols[3]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export interface LogKey {
  isoWeek: IsoWeek;
  userId: number;
  lift: Lift;
}

export type LogTable = Table<LogEntry, LogKey>;

export function createTable(client: SheetsClient): LogTable {
  return defineTable<LogEntry, LogKey>(client, {
    tab: TAB,
    header: HEADER,
    parseRow(row, rowNumber) {
      const padded = padRow(row, HEADER.length);
      const parsed = RawRowSchema.safeParse(padded);
      if (!parsed.success) {
        throw new Error(
          `Invalid ${TAB} row at sheet row ${String(rowNumber)}: ${parsed.error.message}`,
        );
      }
      return parsed.data;
    },
    rowFromEntry(e) {
      return [
        e.iso_week,
        e.week_start,
        String(e.user_id),
        e.username ?? "",
        e.lift,
        String(e.weight_kg),
        e.made ? "true" : "false",
        e.logged_at,
      ];
    },
    keyOf: (e) => ({ isoWeek: e.iso_week, userId: e.user_id, lift: e.lift }),
    keysEqual: (a, b) =>
      a.isoWeek === b.isoWeek && a.userId === b.userId && a.lift === b.lift,
  });
}
