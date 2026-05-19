import { randomUUID } from "node:crypto";
import type { Context } from "grammy";
import type { Config } from "../config.js";
import { parseRpvArgs } from "../domain/args.js";
import type { Cooldown, UserCooldown } from "../domain/cooldown.js";
import { summaryLanguage } from "../domain/day.js";
import type { MessageRecord } from "../domain/message.js";
import { encodeNewlines } from "../domain/message.js";
import { randomSnark } from "../domain/snark.js";
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

interface RpvDeps {
  readonly services: Services;
  readonly gemini: GeminiTextClient;
  readonly config: Config;
  readonly groupCooldown: Cooldown;
  readonly userCooldown: UserCooldown;
}

export function buildRpv(deps: RpvDeps) {
  // Single in-flight guard: only one /rpv generation at a time. Telegram's
  // long polling can deliver concurrent commands from different users, and
  // Gemini calls take seconds; without this, two in-flight requests would
  // contend on the sheet read and waste tokens.
  let inFlight = false;

  return async function handleRpv(ctx: Context): Promise<void> {
    const text = ctx.message?.text ?? "";
    const parsed = parseRpvArgs(text, {
      defaultN: deps.config.rpvDefaultN,
      maxN: deps.config.rpvMaxN,
    });
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    const language = summaryLanguage(new Date(), deps.config.timeZone);
    const now = Date.now();
    const userId = ctx.from?.id;

    // Per-user gate first so abusers don't even bump the group counter.
    if (
      userId !== undefined &&
      !deps.userCooldown.tryFire(userId, now)
    ) {
      await ctx.reply(randomSnark(language));
      return;
    }
    // Group-wide gate. Note: a successful tryFire here records the fire,
    // so anyone calling within the window gets snark — including the user
    // who just fired (their next call will still hit per-user first, but
    // if their per-user window is shorter than the group window they'd
    // hit this branch instead).
    if (!deps.groupCooldown.tryFire(now)) {
      await ctx.reply(randomSnark(language));
      return;
    }
    if (inFlight) {
      await ctx.reply(randomSnark(language));
      return;
    }
    inFlight = true;
    try {
      const all = await deps.services.messages.listAll();
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
      const transcript = renderTranscript(tail, deps.config.timeZone);
      const summary = await deps.gemini.generate({
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
        requested_by: userId ?? 0,
        text: encodeNewlines(summary),
      };
      deps.services.summaries.upsert(record).catch((err: unknown) => {
        console.error("rpvbot: summary log failed:", err);
      });
    } finally {
      inFlight = false;
    }
  };
}
