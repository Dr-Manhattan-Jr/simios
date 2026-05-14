import { parseTelegramUser } from "@simios/telegram-kit";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import type { Participant } from "../domain/participant.js";

export function buildLeave(services: Services) {
  return async function handleLeave(ctx: BotContext): Promise<void> {
    const user = parseTelegramUser(ctx);
    if (user === undefined) {
      await ctx.reply("Cannot identify you.");
      return;
    }
    const existing = await services.participants.findByKey(user.user_id);
    if (existing === undefined) {
      await ctx.reply("You're not currently in the challenge.");
      return;
    }
    if (existing.left_at !== undefined) {
      await ctx.reply("You already left.");
      return;
    }
    const updated: Participant = {
      ...existing,
      left_at: new Date().toISOString(),
    };
    await services.participants.upsert(updated);
    await ctx.reply(
      "You're out. Your past entries are kept. /join again any time.",
    );
  };
}
