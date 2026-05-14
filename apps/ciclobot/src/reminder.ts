import type { Bot } from "grammy";
import { mention, type TelegramUser } from "@simios/telegram-kit";
import type { BotContext } from "./context.js";
import type { Services } from "./services.js";
import { REQUIRED_LIFTS, type Lift } from "./domain/lifts.js";
import { isActive, type Participant } from "./domain/participant.js";
import { currentIsoWeek } from "./domain/week.js";

function userFromParticipant(p: Participant): TelegramUser {
  const base = {
    user_id: p.user_id,
    first_name: p.username ?? `id${String(p.user_id)}`,
  };
  return p.username !== undefined ? { ...base, username: p.username } : base;
}

export async function runReminder(
  bot: Bot<BotContext>,
  services: Services,
): Promise<void> {
  const timeZone = services.config.timeZone;
  const isoWeek = currentIsoWeek(new Date(), timeZone);

  const [allParticipants, allLogs, allBws] = await Promise.all([
    services.participants.listAll(),
    services.log.listAll(),
    services.bodyweight.listAll(),
  ]);
  const active = allParticipants.filter(isActive);
  if (active.length === 0) return;

  const weekLogs = allLogs.filter((e) => e.iso_week === isoWeek);
  const weekBws = allBws.filter((e) => e.iso_week === isoWeek);

  const lines: string[] = [];
  for (const p of active) {
    const missingLifts: Lift[] = REQUIRED_LIFTS.filter(
      (lift) =>
        !weekLogs.some((e) => e.user_id === p.user_id && e.lift === lift),
    );
    const missingBodyweight = !weekBws.some((e) => e.user_id === p.user_id);
    if (missingLifts.length === 0 && !missingBodyweight) continue;
    const parts: string[] = [];
    if (missingLifts.length > 0) parts.push(missingLifts.join(", "));
    if (missingBodyweight) parts.push("bodyweight");
    lines.push(`${mention(userFromParticipant(p))} — missing: ${parts.join(", ")}`);
  }

  if (lines.length === 0) return;

  await bot.api.sendMessage(
    services.config.chatId,
    `Sunday reminder — week ${isoWeek}\n${lines.join("\n")}`,
  );
}
