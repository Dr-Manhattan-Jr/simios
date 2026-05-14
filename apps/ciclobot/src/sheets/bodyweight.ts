import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import {
  BodyweightEntrySchema,
  type BodyweightEntry,
} from "../domain/bodyweight.js";
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from "../domain/participant.js";
import { IsoWeekSchema, type IsoWeek } from "../domain/week.js";

export const TAB = "bodyweight";
export const HEADER: Row = [
  "iso_week",
  "week_start",
  "user_id",
  "username",
  "weight_kg",
  "logged_at",
];

const RawRowSchema = z
  .tuple([
    IsoWeekSchema,
    z.string().min(1),
    z.coerce.number().int(),
    z.string(),
    z.coerce.number().min(WEIGHT_MIN_KG).max(WEIGHT_MAX_KG),
    z.string().min(1),
  ])
  .transform((cols): BodyweightEntry => {
    const base = {
      iso_week: cols[0],
      week_start: cols[1],
      user_id: cols[2],
      weight_kg: cols[4],
      logged_at: cols[5],
    };
    return BodyweightEntrySchema.parse(withOptional(base, "username", cols[3]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export interface BodyweightKey {
  isoWeek: IsoWeek;
  userId: number;
}

export type BodyweightTable = Table<BodyweightEntry, BodyweightKey>;

export function createTable(client: SheetsClient): BodyweightTable {
  return defineTable<BodyweightEntry, BodyweightKey>(client, {
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
        String(e.weight_kg),
        e.logged_at,
      ];
    },
    keyOf: (e) => ({ isoWeek: e.iso_week, userId: e.user_id }),
    keysEqual: (a, b) => a.isoWeek === b.isoWeek && a.userId === b.userId,
  });
}
