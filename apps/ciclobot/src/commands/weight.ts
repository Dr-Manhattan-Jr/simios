import { parseTelegramUser } from "@simios/telegram-kit";
import { withOptional } from "@simios/sheets-client";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import {
  BodyweightEntrySchema,
  type BodyweightEntry,
} from "../domain/bodyweight.js";
import { KgSchema } from "../domain/parse.js";
import { BodyweightKgSchema, isActive } from "../domain/participant.js";
import { currentIsoWeek, currentWeekStart } from "../domain/week.js";

export function buildWeight(services: Services) {
  return async function handleWeight(ctx: BotContext): Promise<void> {
    const user = parseTelegramUser(ctx);
    if (user === undefined) {
      await ctx.reply("Cannot identify you.");
      return;
    }
    const participant = await services.participants.findByKey(user.user_id);
    if (participant === undefined || !isActive(participant)) {
      await ctx.reply("Use /join to enter the challenge first.");
      return;
    }

    const text = ctx.message?.text ?? "";
    const args = text.split(/\s+/).slice(1);
    const raw = args[0];
    if (raw === undefined) {
      await ctx.reply("Usage: /weight <kg>\nExample: /weight 82.5");
      return;
    }
    const num = KgSchema.safeParse(raw);
    if (!num.success) {
      await ctx.reply(`Couldn't read "${raw}" as a number. Example: 82.5`);
      return;
    }
    const validated = BodyweightKgSchema.safeParse(num.data);
    if (!validated.success) {
      await ctx.reply("Out of range. Body weight must be between 30 and 300 kg.");
      return;
    }

    const now = new Date();
    const timeZone = services.config.timeZone;
    const isoWeek = currentIsoWeek(now, timeZone);
    const weekStart = currentWeekStart(now, timeZone);

    const base = {
      iso_week: isoWeek,
      week_start: weekStart,
      user_id: user.user_id,
      weight_kg: validated.data,
      logged_at: now.toISOString(),
    };
    const parsed = BodyweightEntrySchema.safeParse(
      withOptional(base, "username", user.username),
    );
    if (!parsed.success) {
      await ctx.reply("Invalid bodyweight entry.");
      return;
    }
    const entry: BodyweightEntry = parsed.data;
    await services.bodyweight.upsert(entry);
    await ctx.reply(
      `Logged body weight: ${String(validated.data)} kg for ${isoWeek}.`,
    );
  };
}
