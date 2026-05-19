import { z } from "zod";

/**
 * One row per text message we observed in the configured chat. Stored on
 * the `rpv_messages` tab. Key is the Telegram `message_id` — per-chat
 * unique, so sheet upsert is naturally idempotent on re-delivery.
 *
 * `text` keeps newlines encoded as the literal two-character sequence
 * `\n` so each message fits in a single Sheets cell.
 */
export const MessageRecordSchema = z.object({
  message_id: z.number().int().positive(),
  sent_at: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string().min(1),
  text: z.string(),
  reply_to_id: z.number().int().nonnegative(),
});
export type MessageRecord = z.infer<typeof MessageRecordSchema>;

const NEWLINE_ESCAPE = "\\n";

export function encodeNewlines(text: string): string {
  return text.replace(/\r\n|\r|\n/g, NEWLINE_ESCAPE);
}

export function decodeNewlines(text: string): string {
  return text.replace(/\\n/g, "\n");
}
