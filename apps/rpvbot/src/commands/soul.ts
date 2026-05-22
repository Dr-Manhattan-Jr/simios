import type { Context } from "grammy";
import type { Config } from "../config.js";
import { summaryLanguage, type SummaryLanguage } from "../domain/day.js";
import { parseSoulArgs } from "../domain/soul-args.js";
import {
  renderSoulCard,
  SOUL_CARD_PARSE_MODE,
} from "../domain/soul-card-render.js";
import type { SoulRecord } from "../domain/soul.js";
import type { Services } from "../services.js";

interface SoulDeps {
  readonly services: Services;
  readonly config: Config;
}

/**
 * In-character reply when no card exists for the requested @username —
 * either the handle is unknown, or the member only has a legacy
 * free-text soul that doesn't render as a card. Capitán RPV hasn't
 * chronicled them yet.
 */
function notFoundReply(username: string, language: SummaryLanguage): string {
  return language === "en"
    ? `I haven't chronicled @${username} yet — no soul to show.`
    : `Aún no he registrado el alma de @${username}.`;
}

/** Find the soul whose stored username matches `wanted`, case-insensitively. */
function findByUsername(
  souls: readonly SoulRecord[],
  wanted: string,
): SoulRecord | undefined {
  const target = wanted.toLowerCase();
  return souls.find(
    (s) => s.username !== undefined && s.username.toLowerCase() === target,
  );
}

export function buildSoul(deps: SoulDeps) {
  return async function handleSoul(ctx: Context): Promise<void> {
    const parsed = parseSoulArgs(ctx.message?.text ?? "");
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    const language = summaryLanguage(new Date(), deps.config.timeZone);
    const triggerId = ctx.message?.message_id;

    let card: string | null = null;
    try {
      const souls = await deps.services.souls.listAll();
      // Array.find yields SoulRecord | undefined; renderSoulCard yields
      // null for a legacy free-text soul — both collapse to "no card".
      const soul = findByUsername(souls, parsed.username);
      card = soul === undefined ? null : renderSoulCard(soul, language);
    } catch (err) {
      console.error("rpvbot: /soul lookup failed:", err);
      const apology =
        language === "en"
          ? "Couldn't reach the soul registry. Try again in a moment."
          : "No he podido alcanzar el registro de almas. Inténtalo en un momento.";
      await ctx.reply(apology).catch((replyErr: unknown) => {
        console.error("rpvbot: failed to send /soul error:", replyErr);
      });
      return;
    }

    if (card === null) {
      await ctx.reply(notFoundReply(parsed.username, language));
      return;
    }
    await sendCard(ctx, card, triggerId);
  };
}

/**
 * Send the rendered card, reply-quoting the triggering /soul so it
 * threads under the request (same as /rpv).
 *
 * The card uses `parse_mode: Markdown`. The renderer escapes every
 * metacharacter, so a parse error should not happen — but
 * member-influenced text is unpredictable, so on ANY send failure we
 * retry once as plain text (no parse_mode). A card with literal `*`/`_`
 * markers beats no card at all. Only if the plain retry also fails do
 * we give up and log.
 */
async function sendCard(
  ctx: Context,
  card: string,
  triggerId: number | undefined,
): Promise<void> {
  const replyTo =
    triggerId !== undefined
      ? { reply_parameters: { message_id: triggerId } }
      : {};
  try {
    await ctx.reply(card, { parse_mode: SOUL_CARD_PARSE_MODE, ...replyTo });
  } catch (err) {
    console.error("rpvbot: /soul Markdown send failed, retrying plain:", err);
    await ctx.reply(card, replyTo).catch((plainErr: unknown) => {
      console.error("rpvbot: /soul plain send also failed:", plainErr);
    });
  }
}
