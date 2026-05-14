import { parseTelegramUser } from "@simios/telegram-kit";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { ALL_LIFTS, type Lift } from "../domain/lifts.js";
import type { LogEntry } from "../domain/log-entry.js";
import type { BodyweightEntry } from "../domain/bodyweight.js";
import { descIsoWeek, parseTarget } from "../domain/target.js";

const WEEKS_TO_SHOW = 8;

function takeRecent<T extends { iso_week: string }>(rows: T[]): T[] {
  return [...rows].sort(descIsoWeek).slice(0, WEEKS_TO_SHOW);
}

export function buildHistory(services: Services) {
  return async function handleHistory(ctx: BotContext): Promise<void> {
    const user = parseTelegramUser(ctx);
    if (user === undefined) {
      await ctx.reply("Cannot identify you.");
      return;
    }
    const text = ctx.message?.text ?? "";
    const arg = text.split(/\s+/).slice(1)[0];

    if (arg !== undefined) {
      const target = parseTarget(arg);
      if (target === undefined) {
        await ctx.reply(
          `Unknown filter "${arg}". Use one of: ${ALL_LIFTS.join(", ")}, bodyweight, or no argument.`,
        );
        return;
      }
      if (target.kind === "bodyweight") {
        const all = await services.bodyweight.listAll();
        const mine = all.filter((b) => b.user_id === user.user_id);
        await ctx.reply(formatBodyweight(takeRecent(mine)));
        return;
      }
      const all = await services.log.listAll();
      const mine = all.filter(
        (l) => l.user_id === user.user_id && l.lift === target.lift,
      );
      await ctx.reply(formatLog(takeRecent(mine), target.lift));
      return;
    }

    const [logsAll, bwsAll] = await Promise.all([
      services.log.listAll(),
      services.bodyweight.listAll(),
    ]);
    const mineLogs = logsAll.filter((l) => l.user_id === user.user_id);
    const mineBws = bwsAll.filter((b) => b.user_id === user.user_id);
    const recentLifts = takeRecent(mineLogs);
    const recentBws = takeRecent(mineBws);
    const weeks = new Set<string>([
      ...recentLifts.map((l) => l.iso_week),
      ...recentBws.map((b) => b.iso_week),
    ]);
    const orderedWeeks = [...weeks]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, WEEKS_TO_SHOW);
    if (orderedWeeks.length === 0) {
      await ctx.reply("No entries yet.");
      return;
    }
    const lines: string[] = [];
    for (const w of orderedWeeks) {
      lines.push(`\n${w}`);
      for (const l of recentLifts.filter((entry) => entry.iso_week === w)) {
        lines.push(
          `  ${l.lift}: ${String(l.weight_kg)}kg ${l.completed ? "✅" : "❌"}`,
        );
      }
      const bw = recentBws.find((b) => b.iso_week === w);
      if (bw !== undefined) {
        lines.push(`  bodyweight: ${String(bw.weight_kg)}kg`);
      }
    }
    await ctx.reply(`Your last ${String(WEEKS_TO_SHOW)} weeks:${lines.join("\n")}`);
  };
}

function formatLog(rows: LogEntry[], lift: Lift): string {
  if (rows.length === 0) return `No ${lift} entries yet.`;
  const lines = rows.map(
    (r) => `${r.iso_week}: ${String(r.weight_kg)}kg ${r.completed ? "✅" : "❌"}`,
  );
  return `Your last ${String(WEEKS_TO_SHOW)} ${lift} entries:\n${lines.join("\n")}`;
}

function formatBodyweight(rows: BodyweightEntry[]): string {
  if (rows.length === 0) return "No bodyweight entries yet.";
  const lines = rows.map((r) => `${r.iso_week}: ${String(r.weight_kg)}kg`);
  return `Your last ${String(WEEKS_TO_SHOW)} bodyweight entries:\n${lines.join("\n")}`;
}
