import { type ImageTheme, type TriggerGroup } from "./theme.js";

export interface CompiledTrigger {
  readonly theme: ImageTheme;
  readonly word: string;
  readonly pattern: RegExp;
}

export interface TriggerMatch {
  readonly theme: ImageTheme;
  readonly word: string;
}

export function compileTriggers(
  groups: readonly TriggerGroup[],
): readonly CompiledTrigger[] {
  const compiled: CompiledTrigger[] = [];
  for (const group of groups) {
    for (const word of group.words) {
      compiled.push({
        theme: group.theme,
        word,
        pattern: new RegExp(
          `(?<prefix>^|[^\\p{L}\\p{N}])${escapeRegex(word.toLowerCase())}(?=[^\\p{L}\\p{N}]|$)`,
          "u",
        ),
      });
    }
  }
  return compiled;
}

export function findTriggerMatch(
  text: string,
  triggers: readonly CompiledTrigger[],
): TriggerMatch | undefined {
  if (text.length === 0) return undefined;
  const lowered = text.toLowerCase();
  let bestIndex: number | undefined;
  let bestMatch: TriggerMatch | undefined;
  for (const trigger of triggers) {
    const result = trigger.pattern.exec(lowered);
    if (result === null) continue;
    const prefix = result.groups?.["prefix"];
    if (prefix === undefined) continue;
    const index = result.index + prefix.length;
    if (bestIndex === undefined || index < bestIndex) {
      bestIndex = index;
      bestMatch = { theme: trigger.theme, word: trigger.word };
    }
  }
  return bestMatch;
}

export function matchesTrigger(
  text: string,
  triggers: readonly CompiledTrigger[],
): boolean {
  return findTriggerMatch(text, triggers) !== undefined;
}

export function triggerWordsForTheme(
  groups: readonly TriggerGroup[],
  theme: ImageTheme,
): readonly string[] {
  for (const group of groups) {
    if (group.theme === theme) return group.words;
  }
  throw new Error(`No trigger words configured for theme ${theme}`);
}

const MAX_HINT_CHARS = 200;

/**
 * Pull whatever the user typed alongside a trigger word, so the Gemini
 * prompt can incorporate their intent. Strips all trigger words for the
 * matched theme (case-insensitive, whole-word), collapses whitespace,
 * and trims. Returns undefined when the remainder is empty.
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
    ? `${cleaned.slice(0, MAX_HINT_CHARS).trim()}…`
    : cleaned;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
