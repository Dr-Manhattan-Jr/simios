import { z } from "zod";

/**
 * One row per time the bot fired against a user. Append-only log
 * stored on the `piratas_events` tab. Used to compute the wall-of-shame
 * leaderboards.
 */
export const EventKindSchema = z.enum(["spanish", "correction"]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const PirateEventSchema = z.object({
  // Random, unique enough for our scale — defends against
  // sheet-level duplicates if a row write retries.
  id: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string(),
  kind: EventKindSchema,
  fired_at: z.string().min(1),
});
export type PirateEvent = z.infer<typeof PirateEventSchema>;
