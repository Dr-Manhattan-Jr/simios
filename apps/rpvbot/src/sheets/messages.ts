import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import { MessageRecordSchema, type MessageRecord } from "../domain/message.js";

export const TAB = "rpv_messages";
export const HEADER: Row = [
  "message_id",
  "sent_at",
  "user_id",
  "username",
  "first_name",
  "text",
  "reply_to_id",
];

const RawRowSchema = z
  .tuple([
    z.coerce.number().int().positive(),
    z.string().min(1),
    z.coerce.number().int(),
    z.string(),
    z.string().min(1),
    z.string(),
    z.coerce.number().int().nonnegative(),
  ])
  .transform((cols): MessageRecord => {
    const base = {
      message_id: cols[0],
      sent_at: cols[1],
      user_id: cols[2],
      first_name: cols[4],
      text: cols[5],
      reply_to_id: cols[6],
    };
    return MessageRecordSchema.parse(withOptional(base, "username", cols[3]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type MessagesTable = Table<MessageRecord, number>;

export function createTable(client: SheetsClient): MessagesTable {
  return defineTable<MessageRecord, number>(client, {
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
        String(m.message_id),
        m.sent_at,
        String(m.user_id),
        m.username ?? "",
        m.first_name,
        m.text,
        String(m.reply_to_id),
      ];
    },
    keyOf: (m) => m.message_id,
    keysEqual: (a, b) => a === b,
  });
}
