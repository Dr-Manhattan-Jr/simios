import { JsonObject, NonEmptyString, parseEnv } from "@simios/env";
import { ServiceAccountCredentialsSchema } from "@simios/sheets-client";
import { z } from "zod";

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
  GEMINI_API_KEY: NonEmptyString,
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash"),
  TZ: NonEmptyString.default("Europe/Madrid"),
  COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(30),
  // Same spreadsheet as ciclobot. We add a `piratas_members` tab there.
  SHEET_ID: NonEmptyString,
  // Same service-account JSON ciclobot uses (the service account must
  // have Editor on the shared sheet).
  GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(
    ServiceAccountCredentialsSchema,
  ),
});

const ConfigSchema = RawEnvSchema.transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  chatId: raw.CHAT_ID,
  geminiApiKey: raw.GEMINI_API_KEY,
  geminiModel: raw.GEMINI_MODEL,
  timeZone: raw.TZ,
  cooldownSeconds: raw.COOLDOWN_SECONDS,
  sheetId: raw.SHEET_ID,
  serviceAccount: raw.GOOGLE_SERVICE_ACCOUNT_JSON,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
