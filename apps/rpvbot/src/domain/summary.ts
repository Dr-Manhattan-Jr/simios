import { z } from "zod";

export const SummaryKindSchema = z.enum(["daily", "unread"]);
export type SummaryKind = z.infer<typeof SummaryKindSchema>;

/**
 * One row per summary the bot produced (daily-cron or /rpv on demand).
 * Stored on the `rpv_summaries` tab; kept forever so a future retrieval
 * command can list past resumes.
 */
export const SummaryRecordSchema = z.object({
  id: z.string().min(1),
  kind: SummaryKindSchema,
  generated_at: z.string().min(1),
  window_start: z.string().min(1),
  window_end: z.string().min(1),
  message_count: z.number().int().nonnegative(),
  requested_by: z.number().int(),
  text: z.string(),
});
export type SummaryRecord = z.infer<typeof SummaryRecordSchema>;
