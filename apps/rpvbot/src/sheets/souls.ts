import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import { SoulRecordSchema, type SoulRecord } from "../domain/soul.js";

export const TAB = "rpv_souls";
export const HEADER: Row = [
  "user_id",
  "username",
  "first_name",
  "soul_text",
  "soul_chars",
  "updated_at",
  "runs",
];

const RawRowSchema = z
  .tuple([
    z.coerce.number().int(),
    z.string(),
    z.string().min(1),
    z.string(),
    z.coerce.number().int().nonnegative(),
    z.string().min(1),
    z.coerce.number().int().nonnegative(),
  ])
  .transform((cols): SoulRecord => {
    const base = {
      user_id: cols[0],
      first_name: cols[2],
      soul_text: cols[3],
      soul_chars: cols[4],
      updated_at: cols[5],
      runs: cols[6],
    };
    return SoulRecordSchema.parse(withOptional(base, "username", cols[1]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type SoulsTable = Table<SoulRecord, number>;

export function createTable(client: SheetsClient): SoulsTable {
  return defineTable<SoulRecord, number>(client, {
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
    rowFromEntry(s) {
      return [
        String(s.user_id),
        s.username ?? "",
        s.first_name,
        s.soul_text,
        String(s.soul_chars),
        s.updated_at,
        String(s.runs),
      ];
    },
    keyOf: (s) => s.user_id,
    keysEqual: (a, b) => a === b,
  });
}
