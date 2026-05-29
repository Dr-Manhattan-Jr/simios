import { parseTelegramUser, type TelegramUser } from "@simios/telegram-kit";
import { withOptional } from "@simios/sheets-client";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { ALL_DISCIPLINES, parseDiscipline } from "../domain/discipline.js";
import { ALL_LIFTS, parseLift } from "../domain/lifts.js";
import { LogEntrySchema, type LogEntry } from "../domain/log-entry.js";
import {
  DurationSecondsSchema,
  KgSchema,
  KmSchema,
  MadeFlagSchema,
} from "../domain/parse.js";
import { isActive } from "../domain/participant.js";
import {
  formatDuration,
  TriathlonEntrySchema,
  velocityKmh,
  type TriathlonEntry,
} from "../domain/triathlon.js";
import type { Discipline } from "../domain/discipline.js";
import { currentIsoWeek, currentWeekStart } from "../domain/week.js";

const LIFT_USAGE =
  "Usage: /log <lift> <kg> <made|missed>\nExample: /log bench 100 made";
const TRI_USAGE =
  "Usage: /log <bike|swim|run> <km> <time>\nExample: /log bike 40 1:05:00 (time as HH:MM:SS, MM:SS, or 52m)";

/** Handle `/log <bike|swim|run> <km> <time>` once the discipline is known. */
async function logTriathlon(
  services: Services,
  ctx: BotContext,
  user: TelegramUser,
  discipline: Discipline,
  args: string[],
): Promise<void> {
  const distanceRaw = args[1];
  const timeRaw = args[2];
  if (distanceRaw === undefined || timeRaw === undefined) {
    await ctx.reply(TRI_USAGE);
    return;
  }
  const distance = KmSchema.safeParse(distanceRaw);
  if (!distance.success) {
    await ctx.reply(
      `Couldn't read "${distanceRaw}" as a distance. Try a number of km like 40 or 1.5.`,
    );
    return;
  }
  const duration = DurationSecondsSchema.safeParse(timeRaw);
  if (!duration.success) {
    await ctx.reply(
      `Couldn't read "${timeRaw}" as a time. Use HH:MM:SS (1:05:00), MM:SS (52:30), or minutes (52m).`,
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
    discipline,
    distance_km: distance.data,
    duration_seconds: duration.data,
    logged_at: now.toISOString(),
  };
  const parsed = TriathlonEntrySchema.safeParse(
    withOptional(base, "username", user.username),
  );
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => i.message).join("; ");
    await ctx.reply(`Invalid entry: ${reason}`);
    return;
  }
  const entry: TriathlonEntry = parsed.data;
  // Append, not upsert: the (user_id, logged_at) key is unique per /log, so
  // there is never a row to overwrite — append skips the full-tab read.
  await services.triathlon.append(entry);
  await ctx.reply(
    `Logged ${discipline}: ${String(entry.distance_km)} km in ` +
      `${formatDuration(entry.duration_seconds)} ` +
      `(${velocityKmh(entry).toFixed(1)} km/h) for ${isoWeek}.`,
  );
}

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
    const firstRaw = args[0];

    const discipline =
      firstRaw === undefined ? undefined : parseDiscipline(firstRaw);
    if (discipline !== undefined) {
      await logTriathlon(services, ctx, user, discipline, args);
      return;
    }

    if (args.length < 3) {
      await ctx.reply(LIFT_USAGE);
      return;
    }
    const [liftRaw, weightRaw, madeRaw] = args;
    if (liftRaw === undefined || weightRaw === undefined || madeRaw === undefined) {
      await ctx.reply(`Missing argument.\n${LIFT_USAGE}`);
      return;
    }

    const lift = parseLift(liftRaw);
    if (lift === undefined) {
      const lifts = ALL_LIFTS.map((l) => `• ${l}`).join("\n");
      await ctx.reply(
        `❌ "${liftRaw}" isn't a valid lift or discipline.\n\n` +
          `Lifts (type exactly, no aliases):\n${lifts}\n\n` +
          `Triathlon: ${ALL_DISCIPLINES.join(", ")}\n\n` +
          `Examples: /log bench 100 made — /log bike 40 1:05:00`,
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
    const made = MadeFlagSchema.safeParse(madeRaw);
    if (!made.success) {
      await ctx.reply(
        `Couldn't read "${madeRaw}".\n\n` +
          `Use "made" if you hit all 5×5 cleanly, "missed" if you failed any rep ` +
          `(also y/n, yes/no, ✅/❌).`,
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
      made: made.data,
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
      `Logged ${lift}: ${String(weight.data)} kg ${made.data ? "✅ made" : "❌ missed"} for ${isoWeek}.`,
    );
  };
}
