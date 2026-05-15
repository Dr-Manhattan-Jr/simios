import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import {
  EventKindSchema,
  PirateEventSchema,
  type PirateEvent,
} from "../domain/event.js";

export const TAB = "piratas_events";
export const HEADER: Row = [
  "id",
  "user_id",
  "username",
  "first_name",
  "kind",
  "fired_at",
];

const RawRowSchema = z
  .tuple([
    z.string().min(1),
    z.coerce.number().int(),
    z.string(),
    z.string().min(1),
    EventKindSchema,
    z.string().min(1),
  ])
  .transform((cols): PirateEvent => {
    const base = {
      id: cols[0],
      user_id: cols[1],
      first_name: cols[3],
      kind: cols[4],
      fired_at: cols[5],
    };
    return PirateEventSchema.parse(withOptional(base, "username", cols[2]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type EventsTable = Table<PirateEvent, string>;

export function createTable(client: SheetsClient): EventsTable {
  return defineTable<PirateEvent, string>(client, {
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
        e.id,
        String(e.user_id),
        e.username ?? "",
        e.first_name,
        e.kind,
        e.fired_at,
      ];
    },
    keyOf: (e) => e.id,
    keysEqual: (a, b) => a === b,
  });
}
