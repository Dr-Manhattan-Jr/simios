import type { Context } from "grammy";
import type { Services } from "../services.js";

function replyOpts(ctx: Context) {
  const id = ctx.message?.message_id;
  return id === undefined ? {} : { reply_parameters: { message_id: id } };
}

export function buildLeave(services: Services) {
  return async function handleLeave(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (from === undefined) return;
    const existing = await services.members.findByKey(from.id);
    if (existing === undefined || existing.left_at !== undefined) {
      await ctx.reply(
        `No estás a bordo, ${from.first_name}. Tampoco te he visto en mi tripulación.`,
        replyOpts(ctx),
      );
      return;
    }
    const updated = { ...existing, left_at: new Date().toISOString() };
    await services.members.upsert(updated);
    await services.memberCache.refresh();
    await ctx.reply(
      `Como quieras, ${from.first_name}. Bajas a tierra. /join cuando vuelvas a ser un hombre del mar.`,
      replyOpts(ctx),
    );
  };
}
