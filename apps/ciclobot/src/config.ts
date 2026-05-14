import { JsonObject, NonEmptyString, parseEnv } from "@simios/env";
import { ServiceAccountCredentialsSchema } from "@simios/sheets-client";
import { z } from "zod";

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  SHEET_ID: NonEmptyString,
  GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(
    ServiceAccountCredentialsSchema,
  ),
  CHAT_ID: z.coerce.number().int(),
  TZ: NonEmptyString.default("Europe/Madrid"),
});

const ConfigSchema = RawEnvSchema.transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  sheetId: raw.SHEET_ID,
  serviceAccount: raw.GOOGLE_SERVICE_ACCOUNT_JSON,
  chatId: raw.CHAT_ID,
  timeZone: raw.TZ,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
