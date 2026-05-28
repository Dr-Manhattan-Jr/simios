import { NonEmptyString, parseEnv } from "@simios/env";
import { z } from "zod";
import { TriggerGroupSchema } from "./domain/theme.js";

const DEFAULT_TRACTOR_TRIGGER_WORDS = ["claude", "claudio"];
const DEFAULT_LUDDITE_TRIGGER_WORDS = "ludita,luditas,luddite,luddites";

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
  TRIGGER_WORDS: TriggerWords.optional(),
  TRACTOR_TRIGGER_WORDS: TriggerWords.optional(),
  LUDDITE_TRIGGER_WORDS: TriggerWords.default(DEFAULT_LUDDITE_TRIGGER_WORDS),
  COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash-image"),
});

const RuntimeConfigSchema = z.object({
  botToken: NonEmptyString,
  geminiApiKey: NonEmptyString,
  chatId: z.number().int(),
  triggerGroups: z.array(TriggerGroupSchema).min(1),
  cooldownSeconds: z.number().int().min(0),
  geminiModel: NonEmptyString,
});

const ConfigSchema = RawEnvSchema.transform((raw) =>
  RuntimeConfigSchema.parse({
    botToken: raw.BOT_TOKEN,
    geminiApiKey: raw.GEMINI_API_KEY,
    chatId: raw.CHAT_ID,
    triggerGroups: [
      {
        theme: "tractor",
        words:
          raw.TRACTOR_TRIGGER_WORDS ??
          raw.TRIGGER_WORDS ??
          DEFAULT_TRACTOR_TRIGGER_WORDS,
      },
      {
        theme: "luddite",
        words: raw.LUDDITE_TRIGGER_WORDS,
      },
    ],
    cooldownSeconds: raw.COOLDOWN_SECONDS,
    geminiModel: raw.GEMINI_MODEL,
  }),
);
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
