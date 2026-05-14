export function matchesTrigger(text: string, triggers: readonly string[]): boolean {
  if (text.length === 0) return false;
  const lowered = text.toLowerCase();
  for (const word of triggers) {
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(word)}(?:[^\\p{L}\\p{N}]|$)`, "u");
    if (pattern.test(lowered)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
