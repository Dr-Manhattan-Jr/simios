import { JsonObject, NonEmptyString, parseEnv } from "@simios/env";
import { ServiceAccountCredentialsSchema } from "@simios/sheets-client";
import { z } from "zod";
import {
  MESSAGE_RETENTION_DAYS,
  RPV_DEFAULT_N,
  RPV_MAX_N,
} from "./domain/cap.js";

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
  GEMINI_API_KEY: NonEmptyString,
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash"),
  TZ: NonEmptyString.default("Europe/Madrid"),
  // Same spreadsheet as ciclobot and los_piratas_bot. We add two new tabs.
  SHEET_ID: NonEmptyString,
  GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(
    ServiceAccountCredentialsSchema,
  ),
  // Tunable so dev runs can fire the daily flow without waiting 24h.
  DAILY_RESUME_CRON: NonEmptyString.default("0 9 * * *"),
  PRUNE_CRON: NonEmptyString.default("0 3 * * *"),
  RPV_DEFAULT_N: z.coerce.number().int().positive().default(RPV_DEFAULT_N),
  RPV_MAX_N: z.coerce.number().int().positive().default(RPV_MAX_N),
  MESSAGE_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(MESSAGE_RETENTION_DAYS),
});

const ConfigSchema = RawEnvSchema.transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  chatId: raw.CHAT_ID,
  geminiApiKey: raw.GEMINI_API_KEY,
  geminiModel: raw.GEMINI_MODEL,
  timeZone: raw.TZ,
  sheetId: raw.SHEET_ID,
  serviceAccount: raw.GOOGLE_SERVICE_ACCOUNT_JSON,
  dailyResumeCron: raw.DAILY_RESUME_CRON,
  pruneCron: raw.PRUNE_CRON,
  rpvDefaultN: raw.RPV_DEFAULT_N,
  rpvMaxN: raw.RPV_MAX_N,
  messageRetentionDays: raw.MESSAGE_RETENTION_DAYS,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
