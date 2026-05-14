import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  ParticipantSchema,
  type Participant,
} from "../domain/participant.js";

export const TAB = "participants";
export const HEADER: Row = [
  "user_id",
  "username",
  "height_cm",
  "joined_at",
  "left_at",
];

const RawRowSchema = z
  .tuple([
    z.coerce.number().int(),
    z.string(),
    z.coerce.number().min(HEIGHT_MIN_CM).max(HEIGHT_MAX_CM),
    z.string().min(1),
    z.string(),
  ])
  .transform((cols): Participant => {
    const base = { user_id: cols[0], height_cm: cols[2], joined_at: cols[3] };
    const draft = withOptional(
      withOptional(base, "username", cols[1]),
      "left_at",
      cols[4],
    );
    return ParticipantSchema.parse(draft);
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type ParticipantsTable = Table<Participant, number>;

export function createTable(client: SheetsClient): ParticipantsTable {
  return defineTable<Participant, number>(client, {
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
    rowFromEntry(p) {
      return [
        String(p.user_id),
        p.username ?? "",
        String(p.height_cm),
        p.joined_at,
        p.left_at ?? "",
      ];
    },
    keyOf: (p) => p.user_id,
    keysEqual: (a, b) => a === b,
  });
}
