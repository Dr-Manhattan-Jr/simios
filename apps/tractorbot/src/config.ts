import { NonEmptyString, parseEnv } from "@simios/env";
import { z } from "zod";

const TriggerWords = z
  .string()
  .min(1)
  .transform((raw) =>
    raw
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0),
  )
  .pipe(z.array(z.string().min(1)).min(1));

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  GEMINI_API_KEY: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
  TRACTOR_TRIGGER_WORDS: TriggerWords.default("claude,claudio"),
  LUDDITE_TRIGGER_WORDS: TriggerWords.default(
    "ludita,luditas,luddite,luddites",
  ),
  COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash-image"),
});

const ConfigSchema = RawEnvSchema.transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  geminiApiKey: raw.GEMINI_API_KEY,
  chatId: raw.CHAT_ID,
  triggerGroups: [
    { theme: "tractor" as const, words: raw.TRACTOR_TRIGGER_WORDS },
    { theme: "luddite" as const, words: raw.LUDDITE_TRIGGER_WORDS },
  ],
  cooldownSeconds: raw.COOLDOWN_SECONDS,
  geminiModel: raw.GEMINI_MODEL,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
