import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import { MemberSchema, type Member } from "../domain/member.js";

export const TAB = "piratas_members";
export const HEADER: Row = [
  "user_id",
  "username",
  "first_name",
  "joined_at",
  "left_at",
];

const RawRowSchema = z
  .tuple([
    z.coerce.number().int(),
    z.string(),
    z.string().min(1),
    z.string().min(1),
    z.string(),
  ])
  .transform((cols): Member => {
    const base = {
      user_id: cols[0],
      first_name: cols[2],
      joined_at: cols[3],
    };
    const draft = withOptional(
      withOptional(base, "username", cols[1]),
      "left_at",
      cols[4],
    );
    return MemberSchema.parse(draft);
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type MembersTable = Table<Member, number>;

export function createTable(client: SheetsClient): MembersTable {
  return defineTable<Member, number>(client, {
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
    rowFromEntry(m) {
      return [
        String(m.user_id),
        m.username ?? "",
        m.first_name,
        m.joined_at,
        m.left_at ?? "",
      ];
    },
    keyOf: (m) => m.user_id,
    keysEqual: (a, b) => a === b,
  });
}
