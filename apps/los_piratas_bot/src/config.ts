import { NonEmptyString, parseEnv } from "@simios/env";
import { z } from "zod";

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
  GEMINI_API_KEY: NonEmptyString,
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash"),
  TZ: NonEmptyString.default("Europe/Madrid"),
  COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(30),
});

const ConfigSchema = RawEnvSchema.transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  chatId: raw.CHAT_ID,
  geminiApiKey: raw.GEMINI_API_KEY,
  geminiModel: raw.GEMINI_MODEL,
  timeZone: raw.TZ,
  cooldownSeconds: raw.COOLDOWN_SECONDS,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
