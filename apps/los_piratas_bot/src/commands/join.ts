import type { Context } from "grammy";
import { type Member } from "../domain/member.js";
import { buildMember, type Services } from "../services.js";

function replyOpts(ctx: Context) {
  const id = ctx.message?.message_id;
  return id === undefined ? {} : { reply_parameters: { message_id: id } };
}

export function buildJoin(services: Services) {
  return async function handleJoin(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (from === undefined) return;
    const userId = from.id;
    const now = new Date().toISOString();

    const existing = await services.members.findByKey(userId);
    if (existing !== undefined && existing.left_at === undefined) {
      await ctx.reply(
        `Ya estás a bordo, ${from.first_name}. ¡Voto a bríos, no te emborraches dos veces!`,
        replyOpts(ctx),
      );
      return;
    }

    // Rejoin: keep original joined_at, clear left_at. Fresh join: new row.
    const member: Member = existing !== undefined
      ? (() => {
          const base = {
            user_id: existing.user_id,
            first_name: from.first_name,
            joined_at: existing.joined_at,
          };
          return from.username !== undefined && from.username.length > 0
            ? { ...base, username: from.username }
            : base;
        })()
      : buildMember({
          userId,
          username: from.username,
          firstName: from.first_name,
          joinedAt: now,
        });

    await services.members.upsert(member);
    await services.memberCache.refresh();
    await ctx.reply(
      `¡Bienvenido a bordo, ${from.first_name}! Los viernes hablas inglés o pruebas mi sable. Usa /leave si quieres saltar del barco.`,
      replyOpts(ctx),
    );
  };
}
