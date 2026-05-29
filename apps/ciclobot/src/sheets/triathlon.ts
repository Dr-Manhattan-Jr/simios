import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import { DisciplineSchema } from "../domain/discipline.js";
import {
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  TriathlonEntrySchema,
  type TriathlonEntry,
} from "../domain/triathlon.js";
import { IsoWeekSchema } from "../domain/week.js";

export const TAB = "triathlon";
export const HEADER: Row = [
  "iso_week",
  "week_start",
  "user_id",
  "username",
  "discipline",
  "distance_km",
  "duration_seconds",
  "logged_at",
];

const RawRowSchema = z
  .tuple([
    IsoWeekSchema,
    z.string().min(1),
    z.coerce.number().int(),
    z.string(),
    DisciplineSchema,
    z.coerce.number().min(DISTANCE_MIN_KM).max(DISTANCE_MAX_KM),
    z.coerce.number().int().positive(),
    z.string().min(1),
  ])
  .transform((cols): TriathlonEntry => {
    const base = {
      iso_week: cols[0],
      week_start: cols[1],
      user_id: cols[2],
      discipline: cols[4],
      distance_km: cols[5],
      duration_seconds: cols[6],
      logged_at: cols[7],
    };
    return TriathlonEntrySchema.parse(withOptional(base, "username", cols[3]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

/**
 * Sessions are append-only, so the key is the pair (user_id, logged_at):
 * `logged_at` is the millisecond ISO timestamp of the /log call. A single user
 * cannot fire two messages within the same millisecond, so collisions are
 * vanishingly unlikely; if one ever happened it would overwrite the earlier
 * session rather than error. Commands use `append`, not `upsert`, anyway.
 */
export interface TriathlonKey {
  userId: number;
  loggedAt: string;
}

export type TriathlonTable = Table<TriathlonEntry, TriathlonKey>;

export function createTable(client: SheetsClient): TriathlonTable {
  return defineTable<TriathlonEntry, TriathlonKey>(client, {
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
        e.discipline,
        String(e.distance_km),
        String(e.duration_seconds),
        e.logged_at,
      ];
    },
    keyOf: (e) => ({ userId: e.user_id, loggedAt: e.logged_at }),
    keysEqual: (a, b) => a.userId === b.userId && a.loggedAt === b.loggedAt,
  });
}
