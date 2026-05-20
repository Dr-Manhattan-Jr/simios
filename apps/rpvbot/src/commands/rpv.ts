import { randomUUID } from "node:crypto";
import type { Context } from "grammy";
import type { Config } from "../config.js";
import { parseRpvArgs, type ParsedArgs } from "../domain/args.js";
import type { Cooldown, UserCooldown } from "../domain/cooldown.js";
import { summaryLanguage, type SummaryLanguage } from "../domain/day.js";
import type { MessageRecord } from "../domain/message.js";
import { encodeNewlines } from "../domain/message.js";
import { renderSouls } from "../domain/soul.js";
import { snarkWithCooldown } from "../domain/snark.js";
import type { SummaryRecord } from "../domain/summary.js";
import { renderTranscript } from "../domain/transcript.js";
import type { GeminiTextClient } from "../gemini/text.js";
import {
  buildQuestionPrompt,
  buildUserPrompt,
  systemPrompt,
  systemPromptForQuestion,
} from "../prompt/capitan-rpv.js";
import type { Services } from "../services.js";

const UNREAD_EMOJI = "🧭";
const QUESTION_EMOJI = "🧭";

function unreadPrefix(n: number): string {
  return `${UNREAD_EMOJI} Unread Resume — last ${String(n)} messages`;
}

function questionPrefix(question: string): string {
  // Cap the prefix line at ~60 chars so the header stays one line in
  // Telegram. The full sanitised question is in the prompt to the model
  // and in the rpv_summaries `text` cell for retrieval.
  const truncated =
    question.length > 60 ? question.slice(0, 60).trimEnd() + "…" : question;
  return `${QUESTION_EMOJI} Question — ${truncated}`;
}

function emptyReply(n: number, language: SummaryLanguage): string {
  const body =
    language === "en"
      ? "Nothing to chronicle yet, captain."
      : "No hay nada que resumir todavía, capitán.";
  return `${unreadPrefix(n)}\n\n${body}`;
}

function emptyQuestionReply(
  question: string,
  language: SummaryLanguage,
): string {
  const body =
    language === "en"
      ? "I have no messages to answer from yet."
      : "Aún no tengo mensajes desde los que responder.";
  return `${questionPrefix(question)}\n\n${body}`;
}

interface RpvDeps {
  readonly services: Services;
  readonly gemini: GeminiTextClient;
  readonly config: Config;
  readonly groupCooldown: Cooldown;
  readonly userCooldown: UserCooldown;
}

function sortAscByDate<T extends { sent_at: string }>(arr: readonly T[]): T[] {
  return [...arr].sort((a, b) =>
    a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0,
  );
}

function sortDescByDate<T extends { sent_at: string }>(arr: readonly T[]): T[] {
  return [...arr].sort((a, b) =>
    a.sent_at < b.sent_at ? 1 : a.sent_at > b.sent_at ? -1 : 0,
  );
}

async function handleCount(
  parsed: Extract<ParsedArgs, { kind: "count" }>,
  ctx: Context,
  deps: RpvDeps,
  language: SummaryLanguage,
): Promise<void> {
  const all = await deps.services.messages.listAll();
  const tail: MessageRecord[] = sortAscByDate(
    sortDescByDate(all).slice(0, parsed.n),
  );
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
  // Reply-quote the triggering /rpv so the answer threads under it in
  // Telegram — easier to scan when several people use the bot in
  // sequence. Only on the success path; snark/error/empty stay standalone.
  const replyText = `${unreadPrefix(tail.length)}\n\n${summary}`;
  const triggerId = ctx.message?.message_id;
  if (triggerId !== undefined) {
    await ctx.reply(replyText, { reply_parameters: { message_id: triggerId } });
  } else {
    await ctx.reply(replyText);
  }

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
  deps.services.summaries.upsert(record).catch((err: unknown) => {
    console.error("rpvbot: summary log failed:", err);
  });
}

async function handleQuestion(
  parsed: Extract<ParsedArgs, { kind: "question" }>,
  ctx: Context,
  deps: RpvDeps,
  language: SummaryLanguage,
): Promise<void> {
  // Souls are fetched in parallel — they give the model background on
  // who each member is, while the transcript stays the source of hard
  // facts. Group is small, so all souls are injected every question.
  // Souls are best-effort: a transient rpv_souls read error degrades to
  // a transcript-only answer rather than failing the whole question.
  const [all, allSouls] = await Promise.all([
    deps.services.messages.listAll(),
    deps.services.souls.listAll().catch((err: unknown) => {
      console.error("rpvbot: souls read failed, answering without them:", err);
      return [];
    }),
  ]);
  // Bound the context window: questions don't need 30 days of chat to
  // answer, and the token budget for one /rpv call is finite. The user
  // can always /rpv N for a literal summary.
  const tail: MessageRecord[] = sortAscByDate(
    sortDescByDate(all).slice(0, deps.config.questionContextMessages),
  );
  if (tail.length === 0) {
    await ctx.reply(emptyQuestionReply(parsed.text, language));
    return;
  }

  const transcript = renderTranscript(tail, deps.config.timeZone);
  const souls = renderSouls(allSouls);
  // Lower temperature than summary mode: factual answering, not creative
  // storytelling. We want grounded, short, and confident-or-refuse.
  const answer = await deps.gemini.generate({
    system: systemPromptForQuestion(language),
    user: buildQuestionPrompt({
      question: parsed.text,
      transcript,
      souls,
      language,
    }),
    temperature: 0.3,
  });
  const replyText = `${questionPrefix(parsed.text)}\n\n${answer}`;
  const triggerId = ctx.message?.message_id;
  if (triggerId !== undefined) {
    await ctx.reply(replyText, { reply_parameters: { message_id: triggerId } });
  } else {
    await ctx.reply(replyText);
  }

  const firstSentAt = tail[0]?.sent_at ?? new Date().toISOString();
  const lastSentAt = tail[tail.length - 1]?.sent_at ?? firstSentAt;
  // Store Q + A together in the `text` cell so a future retrieval
  // command ("show me past questions") has self-contained rows.
  const stored = `Q: ${parsed.text}\nA: ${answer}`;
  const record: SummaryRecord = {
    id: randomUUID(),
    kind: "question",
    generated_at: new Date().toISOString(),
    window_start: firstSentAt,
    window_end: lastSentAt,
    message_count: tail.length,
    requested_by: ctx.from?.id ?? 0,
    text: encodeNewlines(stored),
  };
  deps.services.summaries.upsert(record).catch((err: unknown) => {
    console.error("rpvbot: summary log failed:", err);
  });
}

export function buildRpv(deps: RpvDeps) {
  // Single in-flight guard: only one /rpv generation at a time. Telegram's
  // long polling can deliver concurrent commands from different users,
  // and Gemini calls take seconds; without this, two in-flight requests
  // would contend on the sheet read and waste tokens.
  let inFlight = false;

  return async function handleRpv(ctx: Context): Promise<void> {
    const text = ctx.message?.text ?? "";
    const parsed = parseRpvArgs(text, {
      maxN: deps.config.rpvMaxN,
      questionMaxChars: deps.config.questionMaxChars,
    });
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    const language = summaryLanguage(new Date(), deps.config.timeZone);
    const now = Date.now();
    const userId = ctx.from?.id;

    // Per-user gate first so abusers don't even bump the group counter.
    if (userId !== undefined) {
      const userGate = deps.userCooldown.tryFire(userId, now);
      if (!userGate.fired) {
        await ctx.reply(snarkWithCooldown(language, userGate.remainingMs));
        return;
      }
    }
    const groupGate = deps.groupCooldown.tryFire(now);
    if (!groupGate.fired) {
      await ctx.reply(snarkWithCooldown(language, groupGate.remainingMs));
      return;
    }
    if (inFlight) {
      // No exact remaining time for an in-flight request; just snark.
      await ctx.reply(snarkWithCooldown(language, 0));
      return;
    }
    inFlight = true;
    try {
      if (parsed.kind === "count") {
        await handleCount(parsed, ctx, deps, language);
      } else {
        await handleQuestion(parsed, ctx, deps, language);
      }
    } catch (err) {
      // Send a generic, non-leaky reply on Gemini/sheet failure so the
      // user knows their command was received. Detailed error stays in
      // the bot logs only — never echoed back to Telegram.
      console.error("rpvbot: /rpv handler failed:", err);
      const apology =
        language === "en"
          ? "Couldn't reach the chronicler. Try again in a moment."
          : "No he podido alcanzar al cronista. Inténtalo en un momento.";
      await ctx.reply(apology).catch((replyErr: unknown) => {
        console.error("rpvbot: failed to send error apology:", replyErr);
      });
    } finally {
      inFlight = false;
    }
  };
}
