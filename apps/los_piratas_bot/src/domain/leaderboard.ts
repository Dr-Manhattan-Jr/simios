import type { EventKind, PirateEvent } from "./event.js";

export interface LeaderboardEntry {
  user_id: number;
  username?: string;
  first_name: string;
  count: number;
}

interface Acc {
  user_id: number;
  username: string | undefined;
  first_name: string;
  count: number;
  last_fired_at: string;
}

function toEntry(a: Acc): LeaderboardEntry {
  const base = { user_id: a.user_id, first_name: a.first_name, count: a.count };
  return a.username !== undefined && a.username.length > 0
    ? { ...base, username: a.username }
    : base;
}

/**
 * Top-N tally by user for a given event kind. Most recent username +
 * first_name win — Telegram handles change, this keeps the display
 * label fresh. Sort: count desc, then user_id asc for determinism.
 */
export function topByKind(
  events: ReadonlyArray<PirateEvent>,
  kind: EventKind,
  limit: number,
): LeaderboardEntry[] {
  const byUser = new Map<number, Acc>();
  for (const e of events) {
    if (e.kind !== kind) continue;
    const existing = byUser.get(e.user_id);
    if (existing === undefined) {
      byUser.set(e.user_id, {
        user_id: e.user_id,
        username: e.username,
        first_name: e.first_name,
        count: 1,
        last_fired_at: e.fired_at,
      });
      continue;
    }
    existing.count += 1;
    if (e.fired_at > existing.last_fired_at) {
      existing.last_fired_at = e.fired_at;
      existing.first_name = e.first_name;
      existing.username = e.username;
    }
  }
  return [...byUser.values()]
    .sort((a, b) => b.count - a.count || a.user_id - b.user_id)
    .slice(0, limit)
    .map(toEntry);
}

export function displayName(entry: LeaderboardEntry): string {
  return entry.username !== undefined && entry.username.length > 0
    ? `@${entry.username}`
    : entry.first_name;
}
