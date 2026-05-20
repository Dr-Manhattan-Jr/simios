import { z } from "zod";
import { fenceBody } from "./fence.js";
import { decodeNewlines, type MessageRecord } from "./message.js";

/**
 * One row per group member with at least one stored message. Updated
 * daily at 12:00 Madrid by the souls cron, which folds the previous
 * day's messages from this user into the existing soul_text via Gemini.
 *
 * Stored on the `rpv_souls` tab. Keyed on user_id so updates are upsert
 * in place — total storage is bounded by the member count, not by time.
 */
export const SoulRecordSchema = z.object({
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string().min(1),
  // Newlines encoded as the literal `\n` two-char sequence so the soul
  // fits in one Sheets cell. Reuses encodeNewlines/decodeNewlines from
  // domain/message.ts.
  soul_text: z.string(),
  // Denormalised length of soul_text (post-truncation, post-encoding) so
  // monitoring the cap is a single column read instead of a string scan.
  soul_chars: z.number().int().nonnegative(),
  updated_at: z.string().min(1),
  // Monotonic counter — helps spot members who go silent (runs stops
  // incrementing) without computing it from updated_at deltas.
  runs: z.number().int().nonnegative(),
});
export type SoulRecord = z.infer<typeof SoulRecordSchema>;

/**
 * Group messages that fall inside `window` by user_id, preserving
 * chronological order within each user's bucket. Pure helper — lives in
 * the domain so cron files stay pure orchestration.
 */
export function groupMessagesByUser(
  allMessages: readonly MessageRecord[],
  window: { readonly startUtc: string; readonly endUtc: string },
): Map<number, MessageRecord[]> {
  const inWindow = allMessages
    .filter((m) => m.sent_at >= window.startUtc && m.sent_at < window.endUtc)
    .sort((a, b) =>
      a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0,
    );
  const byUser = new Map<number, MessageRecord[]>();
  for (const m of inWindow) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push(m);
    byUser.set(m.user_id, arr);
  }
  return byUser;
}

/**
 * Member label for a soul. Members are most often referred to by their
 * @handle in questions ("what is @vidal like?"), so the handle must be
 * front and centre when present. Format: "Josep (@vidal)" — name then
 * handle. When a member has no public username, say so explicitly so
 * the model doesn't treat the absence as meaningful.
 */
function soulLabel(s: SoulRecord): string {
  if (s.username !== undefined && s.username.length > 0) {
    return `${s.first_name} (@${s.username})`;
  }
  return `${s.first_name} (no @handle)`;
}

/**
 * Render all member souls into a plain text block for the /rpv question
 * prompt — one member per line, "Name (@handle): <msg>profile text</msg>".
 * Sorted by first_name for deterministic output. Returns "" for an empty
 * list, so the prompt builder can omit the section entirely.
 *
 * The profile text is fenced in <msg>…</msg> (same mechanism as
 * transcript message bodies): a member can influence their own soul over
 * time by what they type, so fencing keeps an injection-shaped soul from
 * forging prompt structure. soul_text is stored newline-encoded; we
 * decode it and collapse internal whitespace so each member stays on one
 * line.
 */
export function renderSouls(souls: readonly SoulRecord[]): string {
  if (souls.length === 0) return "";
  return [...souls]
    .sort((a, b) => a.first_name.localeCompare(b.first_name))
    .map((s) => {
      const profile = decodeNewlines(s.soul_text).replace(/\s+/g, " ").trim();
      return `${soulLabel(s)}: ${fenceBody(profile)}`;
    })
    .join("\n");
}

/**
 * Truncate a soul to `maxChars` code points (not UTF-16 code units), so
 * emoji and combining marks are never split mid-character. The "…" suffix
 * is included in the cap so the final string is exactly maxChars long.
 */
export function capSoul(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  const codepoints = Array.from(text);
  if (codepoints.length <= maxChars) return text;
  // Reserve room for the ellipsis suffix.
  const headLen = Math.max(0, maxChars - 1);
  return codepoints.slice(0, headLen).join("").trimEnd() + "…";
}
