import { randomUUID } from "node:crypto";
import type { Bot, Context } from "grammy";
import type { Config } from "../config.js";
import { summaryLanguage } from "../domain/day.js";
import { encodeNewlines } from "../domain/message.js";
import type { SummaryRecord } from "../domain/summary.js";
import { renderTranscript } from "../domain/transcript.js";
import { previousCalendarDayBounds } from "../domain/window.js";
import type { GeminiTextClient } from "../gemini/text.js";
import { buildUserPrompt, systemPrompt } from "../prompt/capitan-rpv.js";
import type { Services } from "../services.js";

const PREFIX_EMOJI = "📜";

function dailyPrefix(label: string): string {
  return `${PREFIX_EMOJI} Daily Resume — ${label}`;
}

export async function runDailyResume(
  bot: Bot<Context>,
  services: Services,
  gemini: GeminiTextClient,
  config: Config,
): Promise<void> {
  const window = previousCalendarDayBounds(new Date(), config.timeZone);
  const language = summaryLanguage(new Date(), config.timeZone);

  const all = await services.messages.listAll();
  const windowMessages = all
    .filter(
      (m) => m.sent_at >= window.startUtc && m.sent_at < window.endUtc,
    )
    .sort((a, b) =>
      a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0,
    );

  let body: string;
  if (windowMessages.length === 0) {
    body =
      language === "en"
        ? "A quiet day on deck. Nothing to report from the sea."
        : "Un día tranquilo en cubierta. Sin novedades del mar.";
  } else {
    const transcript = renderTranscript(windowMessages, config.timeZone);
    const windowLabel =
      language === "en"
        ? `yesterday — ${window.label}`
        : `ayer — ${window.label}`;
    body = await gemini.generate({
      system: systemPrompt(language),
      user: buildUserPrompt({
        kind: "daily",
        windowLabel,
        transcript,
        language,
      }),
    });
  }

  const reply = `${dailyPrefix(window.label)}\n\n${body}`;
  await bot.api.sendMessage(config.chatId, reply);

  const record: SummaryRecord = {
    id: randomUUID(),
    kind: "daily",
    generated_at: new Date().toISOString(),
    window_start: window.startUtc,
    window_end: window.endUtc,
    message_count: windowMessages.length,
    requested_by: 0,
    text: encodeNewlines(body),
  };
  services.summaries.upsert(record).catch((err: unknown) => {
    console.error("rpvbot: daily summary log failed:", err);
  });
}
