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

/** Parse a km value like "40", "40km", "1.5". */
export const KmSchema = numberWithSuffix("km");

/**
 * Parse an elapsed-time string into whole seconds. Accepts, in order:
 *   - `HH:MM:SS` (e.g. `1:05:00`)
 *   - `MM:SS`    (e.g. `52:30`)
 *   - `Nm` / `Nmin` / bare minutes (e.g. `52m`, `52min`, `52`, `52.5`)
 * Minutes and seconds in colon form must be 0–59; values can be fractional only
 * in the bare-minutes form.
 */
export const DurationSecondsSchema = z.preprocess((raw, ctx) => {
  const fail = (message: string): typeof z.NEVER => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
  };
  if (typeof raw !== "string") return fail("Expected a duration");
  const text = raw.trim().toLowerCase();
  if (text.length === 0) return fail("Empty duration");

  if (text.includes(":")) {
    const parts = text.split(":");
    if (parts.length !== 2 && parts.length !== 3) {
      return fail("Use HH:MM:SS or MM:SS");
    }
    let total = 0;
    for (const [i, part] of parts.entries()) {
      if (!/^\d+$/.test(part)) return fail("Use HH:MM:SS or MM:SS");
      const n = Number(part);
      // Every field but the leading one is minutes/seconds: must be 0–59.
      if (i > 0 && n > 59) return fail("Minutes and seconds must be 0–59");
      total = total * 60 + n;
    }
    return total;
  }

  const stripped = text.replace(/(min|m)$/, "").trim();
  // Plain decimal only — reject scientific/hex (`5e2`, `0x10`) that Number()
  // would otherwise turn into an absurd, silently-accepted duration.
  if (!/^\d+(\.\d+)?$/.test(stripped)) {
    return fail("Use HH:MM:SS, MM:SS, or minutes like 52m");
  }
  return Math.round(Number(stripped) * 60);
}, z.number().int().positive());
