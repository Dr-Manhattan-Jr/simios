import { detectAll } from "tinyld";

export type Language = "es" | "en" | "other";

const MIN_WORDS = 7;
const MIN_CONFIDENCE = 0.5;

/**
 * Detect whether a message is Spanish, English, or something else.
 *
 * Returns "other" (and the bot stays silent) when:
 *   - the message is too short for reliable detection (< 7 words), OR
 *   - the top language is something other than es/en, OR
 *   - the top language IS es/en but tinyld's confidence is < 0.5.
 *
 * The confidence floor exists because short messages with foreign words
 * (e.g. "so, claude will replace us aham") used to misclassify as
 * Spanish and trigger the bot incorrectly. Better to stay silent on
 * borderline calls than to insult a hispanophone speaking decent
 * English.
 */
export function detectLanguage(text: string): Language {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < MIN_WORDS) return "other";

  const ranked = detectAll(trimmed);
  const top = ranked[0];
  if (top === undefined) return "other";
  if (top.accuracy < MIN_CONFIDENCE) return "other";
  if (top.lang === "es") return "es";
  if (top.lang === "en") return "en";
  return "other";
}
