import { z } from "zod";

/**
 * A pirate-day participant. Stored in the shared ciclobot spreadsheet on
 * a `piratas_members` tab so this bot has its own opt-in list separate
 * from ciclobot's gym participants.
 *
 * `left_at` empty → active; non-empty → opted out, retained for history.
 */
export const MemberSchema = z.object({
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string(),
  joined_at: z.string().min(1),
  left_at: z.string().optional(),
});
export type Member = z.infer<typeof MemberSchema>;

export function isActive(m: Member): boolean {
  return m.left_at === undefined;
}
