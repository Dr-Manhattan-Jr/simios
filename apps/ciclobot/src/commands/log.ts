import { parseTelegramUser } from "@simios/telegram-kit";
import { withOptional } from "@simios/sheets-client";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { ALL_LIFTS, parseLift } from "../domain/lifts.js";
import { LogEntrySchema, type LogEntry } from "../domain/log-entry.js";
import { DoneFlagSchema, KgSchema } from "../domain/parse.js";
import { isActive } from "../domain/participant.js";
import { currentIsoWeek, currentWeekStart } from "../domain/week.js";

export function buildLog(services: Services) {
  return async function handleLog(ctx: BotContext): Promise<void> {
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
    if (args.length < 3) {
      await ctx.reply(
        "Usage: /log <lift> <weight_kg> <done>\nExample: /log bench 100 yes",
      );
      return;
    }
    const [liftRaw, weightRaw, doneRaw] = args;
    if (liftRaw === undefined || weightRaw === undefined || doneRaw === undefined) {
      await ctx.reply("Missing argument. Usage: /log <lift> <weight_kg> <done>");
      return;
    }

    const lift = parseLift(liftRaw);
    if (lift === undefined) {
      await ctx.reply(
        `Unknown lift "${liftRaw}". Allowed: ${ALL_LIFTS.join(", ")}.`,
      );
      return;
    }

    const weight = KgSchema.safeParse(weightRaw);
    if (!weight.success) {
      await ctx.reply(
        `Couldn't read "${weightRaw}" as a weight. Try a number like 100 or 102.5.`,
      );
      return;
    }
    const completed = DoneFlagSchema.safeParse(doneRaw);
    if (!completed.success) {
      await ctx.reply(
        `Couldn't read "${doneRaw}" as yes/no. Try y/n, yes/no, true/false, ✅/❌.`,
      );
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
      lift,
      weight_kg: weight.data,
      completed: completed.data,
      logged_at: now.toISOString(),
    };
    const parsed = LogEntrySchema.safeParse(
      withOptional(base, "username", user.username),
    );
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join("; ");
      await ctx.reply(`Invalid entry: ${reason}`);
      return;
    }
    const entry: LogEntry = parsed.data;

    await services.log.upsert(entry);
    await ctx.reply(
      `Logged ${lift}: ${String(weight.data)} kg ${completed.data ? "✅" : "❌"} for ${isoWeek}.`,
    );
  };
}
