import { JsonObject, NonEmptyString, parseEnv } from "@simios/env";
import { ServiceAccountCredentialsSchema } from "@simios/sheets-client";
import { z } from "zod";
import {
  MESSAGE_RETENTION_DAYS,
  OCR_MAX_IMAGE_BYTES,
  OCR_MAX_PER_RUN,
  QUESTION_CONTEXT_MESSAGES,
  QUESTION_MAX_CHARS,
  RPV_GROUP_COOLDOWN_SECONDS,
  RPV_MAX_N,
  RPV_USER_COOLDOWN_SECONDS,
  SOULS_MAX_CHARS,
} from "./domain/cap.js";

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
  GEMINI_API_KEY: NonEmptyString,
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash"),
  TZ: NonEmptyString.default("Europe/Madrid"),
  // Same spreadsheet as ciclobot and los_piratas_bot. We add tabs here.
  SHEET_ID: NonEmptyString,
  GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(
    ServiceAccountCredentialsSchema,
  ),
  // Tunable so dev runs can fire the daily flows without waiting 24h.
  DAILY_RESUME_CRON: NonEmptyString.default("0 9 * * *"),
  // 02:00 — a heavy ~14-call Gemini run with no user-facing output;
  // runs in the quiet small hours over the day that just ended.
  SOULS_CRON: NonEmptyString.default("0 2 * * *"),
  PRUNE_CRON: NonEmptyString.default("0 3 * * *"),
  OCR_CRON: NonEmptyString.default("0 * * * *"),
  RPV_MAX_N: z.coerce.number().int().positive().default(RPV_MAX_N),
  MESSAGE_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(MESSAGE_RETENTION_DAYS),
  RPV_GROUP_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(RPV_GROUP_COOLDOWN_SECONDS),
  RPV_USER_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(RPV_USER_COOLDOWN_SECONDS),
  SOULS_MAX_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(SOULS_MAX_CHARS),
  QUESTION_MAX_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(QUESTION_MAX_CHARS),
  QUESTION_CONTEXT_MESSAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(QUESTION_CONTEXT_MESSAGES),
  OCR_MAX_PER_RUN: z.coerce
    .number()
    .int()
    .positive()
    .default(OCR_MAX_PER_RUN),
  OCR_MAX_IMAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(OCR_MAX_IMAGE_BYTES),
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
  soulsCron: raw.SOULS_CRON,
  pruneCron: raw.PRUNE_CRON,
  ocrCron: raw.OCR_CRON,
  rpvMaxN: raw.RPV_MAX_N,
  messageRetentionDays: raw.MESSAGE_RETENTION_DAYS,
  rpvGroupCooldownSeconds: raw.RPV_GROUP_COOLDOWN_SECONDS,
  rpvUserCooldownSeconds: raw.RPV_USER_COOLDOWN_SECONDS,
  soulsMaxChars: raw.SOULS_MAX_CHARS,
  questionMaxChars: raw.QUESTION_MAX_CHARS,
  questionContextMessages: raw.QUESTION_CONTEXT_MESSAGES,
  ocrMaxPerRun: raw.OCR_MAX_PER_RUN,
  ocrMaxImageBytes: raw.OCR_MAX_IMAGE_BYTES,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
