import { format } from "date-fns-tz";
import { fenceBody } from "./fence.js";
import { type MessageRecord } from "./message.js";

/**
 * Renders a chronologically ordered transcript fed to Gemini. Timestamps
 * are converted to the configured time zone so the model doesn't have to
 * do TZ math. Reply threading is surfaced via "[↩ to <name>]" when the
 * replied-to message is also in the window.
 *
 * Indirect-injection defence: every message body is fenced between
 * `<msg>` and `</msg>` tags, with any literal `<msg>` / `</msg>` in user
 * input rewritten so a malicious member can't terminate the fence and
 * inject fake structure. Newlines inside a body are kept as the literal
 * two-char `\n` escape rather than real newlines, so the body always
 * occupies exactly one line and a payload like "\n[2026-05-19] @x: …"
 * cannot impersonate a transcript header. The persona system prompts
 * tell the model to treat anything inside `<msg>…</msg>` as data.
 */

export function renderTranscript(
  messages: readonly MessageRecord[],
  timeZone: string,
): string {
  const byId = new Map<number, MessageRecord>();
  for (const m of messages) byId.set(m.message_id, m);

  return messages
    .map((m) => {
      const wallClock = format(new Date(m.sent_at), "yyyy-MM-dd HH:mm", {
        timeZone,
      });
      // Render handle as either "@username (FirstName)" or just "FirstName".
      const handle =
        m.username !== undefined && m.username.length > 0
          ? `@${m.username} (${m.first_name})`
          : m.first_name;
      let replyTag = "";
      if (m.reply_to_id !== 0) {
        const target = byId.get(m.reply_to_id);
        if (target !== undefined) {
          const replyName =
            target.username !== undefined && target.username.length > 0
              ? target.username
              : target.first_name;
          replyTag = ` [↩ to ${replyName}]`;
        }
      }
      // The sheet stores text with newlines as the literal `\n` two-char
      // sequence (encodeNewlines). For the transcript we want EXACTLY
      // that — no real newlines — so the body fits on one line. Skip the
      // usual decodeNewlines step on purpose. fenceBody escapes any
      // literal fence tokens so the <msg> fence stays parser-stable.
      return `[${wallClock}] ${handle}${replyTag}: ${fenceBody(m.text)}`;
    })
    .join("\n");
}
