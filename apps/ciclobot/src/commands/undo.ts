import { parseTelegramUser } from "@simios/telegram-kit";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { ALL_LIFTS } from "../domain/lifts.js";
import { parseTarget } from "../domain/target.js";
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
        `Usage: /undo <lift|bodyweight>\nAllowed lifts: ${ALL_LIFTS.join(", ")}`,
      );
      return;
    }
    const target = parseTarget(arg);
    if (target === undefined) {
      await ctx.reply(
        `Unknown target "${arg}". Use one of: ${ALL_LIFTS.join(", ")}, bodyweight.`,
      );
      return;
    }
    const timeZone = services.config.timeZone;
    const isoWeek = currentIsoWeek(new Date(), timeZone);
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
