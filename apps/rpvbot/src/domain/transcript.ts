import { format } from "date-fns-tz";
import { decodeNewlines, type MessageRecord } from "./message.js";

/**
 * Renders a chronologically ordered transcript fed to Gemini. Timestamps
 * are converted to the configured time zone so the model doesn't have to
 * do TZ math. Reply threading is surfaced via "[↩ to <name>]" when the
 * replied-to message is also in the window.
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
      // The persona prompt instructs the model to use @username when present
      // and the first name otherwise; never emit a "no @" marker that the
      // model might quote back literally.
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
      const text = decodeNewlines(m.text);
      return `[${wallClock}] ${handle}${replyTag}: ${text}`;
    })
    .join("\n");
}
