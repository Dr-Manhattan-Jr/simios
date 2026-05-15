import { detect } from "tinyld";

export type Language = "es" | "en" | "other";

/**
 * Detect whether a message is Spanish, English, or something else.
 * Returns "other" for very short or ambiguous strings — the trigger
 * pipeline should ignore those rather than guess.
 */
export function detectLanguage(text: string): Language {
  const trimmed = text.trim();
  // Very short messages aren't worth detecting — "hi" / "ok" / "👍" / "1"
  // all give garbage results from any language detector.
  if (trimmed.length < 6) return "other";
  const code = detect(trimmed);
  if (code === "es") return "es";
  if (code === "en") return "en";
  return "other";
}
