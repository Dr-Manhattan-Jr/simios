import { detectAll } from "tinyld";

export type Language = "es" | "en" | "other";

// Asymmetric word-count thresholds. False positives feel worse on English
// (correcting fine English is annoying) than on Spanish (an erroneous
// pirate insult lands less awkwardly), so the bar is lower for Spanish.
const ES_MIN_WORDS = 3;
const EN_MIN_WORDS = 7;

/**
 * Detect whether a message is Spanish, English, or something else.
 *
 * tinyld's `accuracy` field turns out to be near-useless for short
 * messages — even clearly Spanish 3–6-word strings score 0.05–0.15.
 * So we don't gate on confidence; we use:
 *
 *   1. Word count — asymmetric floors per language (above).
 *   2. Top-2 inspection — short Spanish often mis-classifies as
 *      Portuguese because they share so many n-grams. If pt is top
 *      and es is a close second, treat as es.
 *
 * The bot stays silent when the message is too short or the top
 * language isn't a target.
 */
export function detectLanguage(text: string): Language {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter((w) => w.length > 0).length;

  const ranked = detectAll(trimmed);
  const top = ranked[0];
  if (top === undefined) return "other";

  // Spanish path: top is es, OR top is pt and es is a close second
  // (relative gap < 50%, meaning es scored at least half as well as pt).
  const second = ranked[1];
  const isSpanish =
    top.lang === "es" ||
    (top.lang === "pt" &&
      second?.lang === "es" &&
      second.accuracy >= top.accuracy * 0.5);
  if (isSpanish) {
    return wordCount >= ES_MIN_WORDS ? "es" : "other";
  }

  if (top.lang === "en") {
    return wordCount >= EN_MIN_WORDS ? "en" : "other";
  }

  return "other";
}
