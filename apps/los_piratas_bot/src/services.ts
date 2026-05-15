import {
  createSheetsClient,
  type SheetsClient,
} from "@simios/sheets-client";
import type { Config } from "./config.js";
import { isActive, type Member } from "./domain/member.js";
import {
  createTable as createMembersTable,
  HEADER as MEMBERS_HEADER,
  TAB as MEMBERS_TAB,
  type MembersTable,
} from "./sheets/members.js";

/**
 * In-memory cache of active member user_ids. Refreshed at startup and on
 * every /join or /leave. Spares us a Sheets API round-trip on every
 * incoming message — the bot needs to check membership constantly and
 * the active set is tiny (small group).
 */
export interface MemberCache {
  has(userId: number): boolean;
  refresh(): Promise<void>;
  size(): number;
}

export interface Services {
  readonly config: Config;
  readonly sheets: SheetsClient;
  readonly members: MembersTable;
  readonly memberCache: MemberCache;
}

export async function createServices(config: Config): Promise<Services> {
  const sheets = createSheetsClient({
    credentials: config.serviceAccount,
    spreadsheetId: config.sheetId,
  });
  const members = createMembersTable(sheets);
  await sheets.ensureTab(MEMBERS_TAB, MEMBERS_HEADER);

  const active = new Set<number>();
  async function refresh(): Promise<void> {
    const all = await members.listAll();
    active.clear();
    for (const m of all) {
      if (isActive(m)) active.add(m.user_id);
    }
  }
  await refresh();

  const memberCache: MemberCache = {
    has: (userId) => active.has(userId),
    refresh,
    size: () => active.size,
  };

  return { config, sheets, members, memberCache };
}

export function buildMember(args: {
  userId: number;
  username: string | undefined;
  firstName: string;
  joinedAt: string;
}): Member {
  const base = {
    user_id: args.userId,
    first_name: args.firstName,
    joined_at: args.joinedAt,
  };
  return args.username !== undefined && args.username.length > 0
    ? { ...base, username: args.username }
    : base;
}
