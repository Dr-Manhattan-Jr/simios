import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { isActive } from "../domain/participant.js";

export function buildParticipants(services: Services) {
  return async function handleParticipants(ctx: BotContext): Promise<void> {
    const all = await services.participants.listAll();
    const active = all.filter(isActive);
    if (active.length === 0) {
      await ctx.reply("Nobody is in the challenge yet. Use /join to enter.");
      return;
    }
    const lines = active.map((p) => {
      const label = p.username !== undefined ? `@${p.username}` : `id:${String(p.user_id)}`;
      return `• ${label} — ${String(p.height_cm)} cm`;
    });
    await ctx.reply(`Active participants:\n${lines.join("\n")}`);
  };
}
