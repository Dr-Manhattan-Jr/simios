import {
  createSheetsClient,
  type SheetsClient,
} from "@simios/sheets-client";
import type { Config } from "./config.js";
import {
  createTable as createMessagesTable,
  HEADER as MESSAGES_HEADER,
  TAB as MESSAGES_TAB,
  type MessagesTable,
} from "./sheets/messages.js";
import {
  createTable as createSummariesTable,
  HEADER as SUMMARIES_HEADER,
  TAB as SUMMARIES_TAB,
  type SummariesTable,
} from "./sheets/summaries.js";

export interface Services {
  readonly config: Config;
  readonly sheets: SheetsClient;
  readonly messages: MessagesTable;
  readonly summaries: SummariesTable;
}

export async function createServices(config: Config): Promise<Services> {
  const sheets = createSheetsClient({
    credentials: config.serviceAccount,
    spreadsheetId: config.sheetId,
  });
  const messages = createMessagesTable(sheets);
  const summaries = createSummariesTable(sheets);
  await Promise.all([
    sheets.ensureTab(MESSAGES_TAB, MESSAGES_HEADER),
    sheets.ensureTab(SUMMARIES_TAB, SUMMARIES_HEADER),
  ]);
  return { config, sheets, messages, summaries };
}
