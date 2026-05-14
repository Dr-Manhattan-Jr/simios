export function compileTriggers(words: readonly string[]): readonly RegExp[] {
  return words.map(
    (word) =>
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escapeRegex(word.toLowerCase())}(?:[^\\p{L}\\p{N}]|$)`,
        "u",
      ),
  );
}

export function matchesTrigger(text: string, patterns: readonly RegExp[]): boolean {
  if (text.length === 0) return false;
  const lowered = text.toLowerCase();
  for (const pattern of patterns) {
    if (pattern.test(lowered)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
