import {
  createSheetsClient,
  type SheetsClient,
} from "@simios/sheets-client";
import type { Config } from "./config.js";
import {
  createTable as createParticipantsTable,
  type ParticipantsTable,
} from "./sheets/participants.js";
import {
  createTable as createLogTable,
  type LogTable,
} from "./sheets/log.js";
import {
  createTable as createBodyweightTable,
  type BodyweightTable,
} from "./sheets/bodyweight.js";

export interface Services {
  readonly config: Config;
  readonly sheets: SheetsClient;
  readonly participants: ParticipantsTable;
  readonly log: LogTable;
  readonly bodyweight: BodyweightTable;
}

export function createServices(config: Config): Services {
  const sheets = createSheetsClient({
    credentials: config.serviceAccount,
    spreadsheetId: config.sheetId,
  });
  return {
    config,
    sheets,
    participants: createParticipantsTable(sheets),
    log: createLogTable(sheets),
    bodyweight: createBodyweightTable(sheets),
  };
}

export async function ensureSheetsReady(services: Services): Promise<void> {
  await Promise.all([
    services.participants.ensure(),
    services.log.ensure(),
    services.bodyweight.ensure(),
  ]);
}
