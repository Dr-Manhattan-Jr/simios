import { parseTelegramUser } from "@simios/telegram-kit";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { ALL_DISCIPLINES } from "../domain/discipline.js";
import { ALL_LIFTS } from "../domain/lifts.js";
import { parseTarget } from "../domain/target.js";
import { descLoggedAt } from "../domain/triathlon.js";
import { currentIsoWeek } from "../domain/week.js";

export function buildUndo(services: Services) {
  return async function handleUndo(ctx: BotContext): Promise<void> {
    const user = parseTelegramUser(ctx);
    if (user === undefined) {
      await ctx.reply("Cannot identify you.");
      return;
    }
    const text = ctx.message?.text ?? "";
    const arg = text.split(/\s+/).slice(1)[0];
    if (arg === undefined) {
      await ctx.reply(
        `Usage: /undo <lift|bodyweight|bike|swim|run>\n` +
          `Lifts: ${ALL_LIFTS.join(", ")}\n` +
          `Triathlon: ${ALL_DISCIPLINES.join(", ")} (removes your latest this week)`,
      );
      return;
    }
    const target = parseTarget(arg);
    if (target === undefined) {
      await ctx.reply(
        `Unknown target "${arg}". Use one of: ${ALL_LIFTS.join(", ")}, ` +
          `bodyweight, ${ALL_DISCIPLINES.join(", ")}.`,
      );
      return;
    }
    const timeZone = services.config.timeZone;
    const isoWeek = currentIsoWeek(new Date(), timeZone);
    if (target.kind === "discipline") {
      const { discipline } = target;
      const sessions = await services.triathlon.listAll();
      const mine = sessions
        .filter(
          (s) =>
            s.user_id === user.user_id &&
            s.iso_week === isoWeek &&
            s.discipline === discipline,
        )
        .sort(descLoggedAt);
      const latest = mine[0];
      if (latest === undefined) {
        await ctx.reply(`No ${discipline} session to remove for ${isoWeek}.`);
        return;
      }
      await services.triathlon.removeByKey({
        userId: latest.user_id,
        loggedAt: latest.logged_at,
      });
      await ctx.reply(
        `Removed your latest ${discipline} session for ${isoWeek}.`,
      );
      return;
    }
    if (target.kind === "bodyweight") {
      const removed = await services.bodyweight.removeByKey({
        isoWeek,
        userId: user.user_id,
      });
      await ctx.reply(
        removed
          ? `Removed your bodyweight entry for ${isoWeek}.`
          : `No bodyweight entry to remove for ${isoWeek}.`,
      );
      return;
    }
    const removed = await services.log.removeByKey({
      isoWeek,
      userId: user.user_id,
      lift: target.lift,
    });
    await ctx.reply(
      removed
        ? `Removed your ${target.lift} entry for ${isoWeek}.`
        : `No ${target.lift} entry to remove for ${isoWeek}.`,
    );
  };
}
