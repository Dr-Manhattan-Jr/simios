import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { z } from "zod";
import {
  ImageKindSchema,
  ImageRecordSchema,
  ImageStatusSchema,
  type ImageRecord,
} from "../domain/image.js";

export const TAB = "rpv_images";
export const HEADER: Row = [
  "message_id",
  "kind",
  "file_id",
  "mime_type",
  "sent_at",
  "user_id",
  "username",
  "first_name",
  "caption",
  "sticker_meta",
  "status",
  "attempts",
  "description",
  "ocr_text",
  "processed_at",
];

const RawRowSchema = z
  .tuple([
    z.coerce.number().int().positive(),
    ImageKindSchema,
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.coerce.number().int(),
    z.string(),
    z.string().min(1),
    z.string(),
    z.string(),
    ImageStatusSchema,
    z.coerce.number().int().nonnegative(),
    z.string(),
    z.string(),
    z.string(),
  ])
  .transform((cols): ImageRecord => {
    const base = {
      message_id: cols[0],
      kind: cols[1],
      file_id: cols[2],
      mime_type: cols[3],
      sent_at: cols[4],
      user_id: cols[5],
      first_name: cols[7],
      caption: cols[8],
      sticker_meta: cols[9],
      status: cols[10],
      attempts: cols[11],
      description: cols[12],
      ocr_text: cols[13],
      processed_at: cols[14],
    };
    return ImageRecordSchema.parse(withOptional(base, "username", cols[6]));
  });

function padRow(raw: Row, width: number): string[] {
  return Array.from({ length: width }, (_, i) => raw[i] ?? "");
}

export type ImagesTable = Table<ImageRecord, number>;

export function createTable(client: SheetsClient): ImagesTable {
  return defineTable<ImageRecord, number>(client, {
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
    rowFromEntry(i) {
      return [
        String(i.message_id),
        i.kind,
        i.file_id,
        i.mime_type,
        i.sent_at,
        String(i.user_id),
        i.username ?? "",
        i.first_name,
        i.caption,
        i.sticker_meta,
        i.status,
        String(i.attempts),
        i.description,
        i.ocr_text,
        i.processed_at,
      ];
    },
    keyOf: (i) => i.message_id,
    keysEqual: (a, b) => a === b,
  });
}
