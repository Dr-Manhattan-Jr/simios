import type { Context } from "grammy";
import { isActive, type Member } from "../domain/member.js";
import {
  displayName,
  topByKind,
  type LeaderboardEntry,
} from "../domain/leaderboard.js";
import type { Services } from "../services.js";

const TOP_N = 3;

function memberLabel(m: Member): string {
  if (m.username !== undefined && m.username.length > 0) return `@${m.username}`;
  return m.first_name;
}

function formatBoard(title: string, entries: LeaderboardEntry[]): string {
  if (entries.length === 0) return `${title}\n  (nadie todavía, por suerte)`;
  const lines = entries.map(
    (e, i) => `  ${String(i + 1)}. ${displayName(e)} — ${String(e.count)}`,
  );
  return `${title}\n${lines.join("\n")}`;
}

export function buildCrew(services: Services) {
  return async function handleCrew(ctx: Context): Promise<void> {
    const [allMembers, allEvents] = await Promise.all([
      services.members.listAll(),
      services.events.listAll(),
    ]);
    const active = allMembers.filter(isActive);
    const crew =
      active.length === 0
        ? "(nadie a bordo todavía — usa /join)"
        : active.map((m) => `  • ${memberLabel(m)}`).join("\n");

    const wallSpanish = topByKind(allEvents, "spanish", TOP_N);
    const wallCorrections = topByKind(allEvents, "correction", TOP_N);

    const message =
      `🏴‍☠️ Tripulación a bordo:\n${crew}\n\n` +
      formatBoard(
        "🤬 Wall of shame — hablaron español en viernes:",
        wallSpanish,
      ) +
      "\n\n" +
      formatBoard(
        "📝 Wall of shame — inglés más roto:",
        wallCorrections,
      );

    await ctx.reply(message);
  };
}
