export function compileTriggers(words: readonly string[]): readonly RegExp[] {
  return words.map(
    (word) =>
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escapeRegex(word.toLowerCase())}(?:[^\\p{L}\\p{N}]|$)`,
        "u",
      ),
  );
}

export function matchesTrigger(
  text: string,
  patterns: readonly RegExp[],
): boolean {
  if (text.length === 0) return false;
  const lowered = text.toLowerCase();
  for (const pattern of patterns) {
    if (pattern.test(lowered)) return true;
  }
  return false;
}

const MAX_HINT_CHARS = 200;

/**
 * Pull whatever the user typed alongside a trigger word, so the Gemini
 * prompt can incorporate their intent. Strips all trigger words
 * (case-insensitive, whole-word), collapses whitespace, and trims.
 * Returns undefined when the remainder is empty.
 */
export function extractUserHint(
  text: string,
  triggerWords: readonly string[],
): string | undefined {
  let stripped = text;
  for (const word of triggerWords) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegex(word)}(?=[^\\p{L}\\p{N}]|$)`,
      "giu",
    );
    stripped = stripped.replace(pattern, "$1");
  }
  const cleaned = stripped.replace(/\s+/gu, " ").trim();
  if (cleaned.length === 0) return undefined;
  return cleaned.length > MAX_HINT_CHARS
    ? `${cleaned.slice(0, MAX_HINT_CHARS).trim()}...`
    : cleaned;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
