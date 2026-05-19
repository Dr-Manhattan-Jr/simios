import { randomUUID } from "node:crypto";
import type { Context } from "grammy";
import type { Config } from "../config.js";
import { parseRpvArgs } from "../domain/args.js";
import { summaryLanguage } from "../domain/day.js";
import type { MessageRecord } from "../domain/message.js";
import { encodeNewlines } from "../domain/message.js";
import type { SummaryRecord } from "../domain/summary.js";
import { renderTranscript } from "../domain/transcript.js";
import type { GeminiTextClient } from "../gemini/text.js";
import { buildUserPrompt, systemPrompt } from "../prompt/capitan-rpv.js";
import type { Services } from "../services.js";

const PREFIX_EMOJI = "🧭";

function unreadPrefix(n: number): string {
  return `${PREFIX_EMOJI} Unread Resume — last ${String(n)} messages`;
}

function emptyReply(n: number, language: "en" | "es"): string {
  const body =
    language === "en"
      ? "Nothing to chronicle yet, captain."
      : "No hay nada que resumir todavía, capitán.";
  return `${unreadPrefix(n)}\n\n${body}`;
}

export function buildRpv(
  services: Services,
  gemini: GeminiTextClient,
  config: Config,
) {
  return async function handleRpv(ctx: Context): Promise<void> {
    const text = ctx.message?.text ?? "";
    const parsed = parseRpvArgs(text, {
      defaultN: config.rpvDefaultN,
      maxN: config.rpvMaxN,
    });
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    const language = summaryLanguage(new Date(), config.timeZone);

    const all = await services.messages.listAll();
    const sortedDesc = [...all].sort((a, b) =>
      a.sent_at < b.sent_at ? 1 : a.sent_at > b.sent_at ? -1 : 0,
    );
    const tail: MessageRecord[] = sortedDesc.slice(0, parsed.n).reverse();
    if (tail.length === 0) {
      await ctx.reply(emptyReply(parsed.n, language));
      return;
    }

    const windowLabel =
      language === "en"
        ? `last ${String(tail.length)} messages`
        : `últimos ${String(tail.length)} mensajes`;
    const transcript = renderTranscript(tail, config.timeZone);
    const summary = await gemini.generate({
      system: systemPrompt(language),
      user: buildUserPrompt({
        kind: "unread",
        windowLabel,
        transcript,
        language,
      }),
    });
    const reply = `${unreadPrefix(tail.length)}\n\n${summary}`;
    await ctx.reply(reply);

    const firstSentAt = tail[0]?.sent_at ?? new Date().toISOString();
    const lastSentAt = tail[tail.length - 1]?.sent_at ?? firstSentAt;
    const record: SummaryRecord = {
      id: randomUUID(),
      kind: "unread",
      generated_at: new Date().toISOString(),
      window_start: firstSentAt,
      window_end: lastSentAt,
      message_count: tail.length,
      requested_by: ctx.from?.id ?? 0,
      text: encodeNewlines(summary),
    };
    services.summaries.upsert(record).catch((err: unknown) => {
      console.error("rpvbot: summary log failed:", err);
    });
  };
}
