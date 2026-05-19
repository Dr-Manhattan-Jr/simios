import {
  defineTable,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import {
  SummaryKindSchema,
  SummaryRecordSchema,
  type SummaryRecord,
} from "../domain/summary.js";

export const TAB = "rpv_summaries";
export const HEADER: Row = [
  "id",
  "kind",
  "generated_at",
  "window_start",
  "window_end",
  "message_count",
  "requested_by",
  "text",
];

const RawRowSchema = z
  .tuple([
    z.string().min(1),
    SummaryKindSchema,
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.coerce.number().int().nonnegative(),
    z.coerce.number().int(),
    z.string(),
  ])
  .transform((cols): SummaryRecord => {
    return SummaryRecordSchema.parse({
      id: cols[0],
      kind: cols[1],
      generated_at: cols[2],
      window_start: cols[3],
      window_end: cols[4],
      message_count: cols[5],
      requested_by: cols[6],
      text: cols[7],
    });
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type SummariesTable = Table<SummaryRecord, string>;

export function createTable(client: SheetsClient): SummariesTable {
  return defineTable<SummaryRecord, string>(client, {
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
        s.id,
        s.kind,
        s.generated_at,
        s.window_start,
        s.window_end,
        String(s.message_count),
        String(s.requested_by),
        s.text,
      ];
    },
    keyOf: (s) => s.id,
    keysEqual: (a, b) => a === b,
  });
}
