import { z } from "zod";

const MADE_TOKENS = new Set([
  "made",
  "y",
  "yes",
  "true",
  "t",
  "1",
  "✅",
  "✓",
]);
const MISSED_TOKENS = new Set([
  "missed",
  "miss",
  "n",
  "no",
  "false",
  "f",
  "0",
  "❌",
  "✗",
  "x",
]);

/**
 * Parse the "did you make the lift" flag. Canonical tokens: `made` / `missed`.
 * `made` means all 5 sets × 5 reps cleanly; `missed` means anything short of
 * that (failed a rep, only did 5x3, etc.). Yes/no/✅/❌ are accepted aliases.
 */
export const MadeFlagSchema = z.preprocess((raw, ctx) => {
  if (typeof raw !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected made/missed",
    });
    return z.NEVER;
  }
  const normalized = raw.trim().toLowerCase();
  if (MADE_TOKENS.has(normalized)) return true;
  if (MISSED_TOKENS.has(normalized)) return false;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Use `made` or `missed` (also yes/no, ✅/❌)",
  });
  return z.NEVER;
}, z.boolean());

function numberWithSuffix(suffix: string) {
  const re = new RegExp(`${suffix}$`);
  return z.preprocess((raw, ctx) => {
    if (typeof raw !== "string" && typeof raw !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a number",
      });
      return z.NEVER;
    }
    const text = typeof raw === "number" ? String(raw) : raw;
    const stripped = text.trim().toLowerCase().replace(re, "").trim();
    if (stripped.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid number",
      });
      return z.NEVER;
    }
    const num = Number(stripped);
    if (!Number.isFinite(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid number",
      });
      return z.NEVER;
    }
    return num;
  }, z.number());
}

/** Parse a kg value like "100", "100kg", "82.5". */
export const KgSchema = numberWithSuffix("kg");

/** Parse a cm value like "178", "178cm". */
export const CmSchema = numberWithSuffix("cm");
