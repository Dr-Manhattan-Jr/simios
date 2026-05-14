import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import {
  OPTIONAL_LIFTS,
  REQUIRED_LIFTS,
  type Lift,
} from "../domain/lifts.js";
import { isActive, type Participant } from "../domain/participant.js";
import { currentIsoWeek } from "../domain/week.js";

function nameFor(p: Participant): string {
  if (p.username !== undefined && p.username.length > 0) return `@${p.username}`;
  return `id:${String(p.user_id)}`;
}

export function buildWeek(services: Services) {
  return async function handleWeek(ctx: BotContext): Promise<void> {
    const timeZone = services.config.timeZone;
    const isoWeek = currentIsoWeek(new Date(), timeZone);

    const [allParticipants, weekLogs, weekBodyweights] = await Promise.all([
      services.participants.listAll(),
      services.log.listAll(),
      services.bodyweight.listAll(),
    ]);
    const active = allParticipants.filter(isActive);
    if (active.length === 0) {
      await ctx.reply("Nobody is in the challenge yet. Use /join to enter.");
      return;
    }
    const logsThisWeek = weekLogs.filter((e) => e.iso_week === isoWeek);
    const bwsThisWeek = weekBodyweights.filter((e) => e.iso_week === isoWeek);

    const lines: string[] = [`Week ${isoWeek}`];
    for (const p of active) {
      const liftCell = (lift: Lift, missingSymbol: string): string => {
        const entry = logsThisWeek.find(
          (e) => e.user_id === p.user_id && e.lift === lift,
        );
        if (entry === undefined) return missingSymbol;
        return `${String(entry.weight_kg)}kg ${entry.completed ? "✅" : "❌"}`;
      };
      const bw = bwsThisWeek.find((e) => e.user_id === p.user_id);
      const bwCell = bw === undefined ? "—" : `${String(bw.weight_kg)}kg`;

      const requiredParts = REQUIRED_LIFTS.map(
        (lift) => `${lift}: ${liftCell(lift, "—")}`,
      );
      const optionalParts = OPTIONAL_LIFTS.map((lift) => {
        const cell = liftCell(lift, "");
        return cell.length === 0 ? undefined : `${lift}: ${cell}`;
      }).filter((s): s is string => s !== undefined);

      const header = `\n${nameFor(p)}`;
      const required = `  ${requiredParts.join(" | ")} | BW: ${bwCell}`;
      const optional =
        optionalParts.length > 0 ? `\n  optional: ${optionalParts.join(" | ")}` : "";
      lines.push(`${header}\n${required}${optional}`);
    }
    await ctx.reply(lines.join("\n"));
  };
}
