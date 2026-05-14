import { z } from "zod";

const TRUE_TOKENS = new Set(["y", "yes", "true", "t", "1", "✅", "✓"]);
const FALSE_TOKENS = new Set(["n", "no", "false", "f", "0", "❌", "✗", "x"]);

export const DoneFlagSchema = z.preprocess((raw, ctx) => {
  if (typeof raw !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected a yes/no value",
    });
    return z.NEVER;
  }
  const normalized = raw.trim().toLowerCase();
  if (TRUE_TOKENS.has(normalized)) return true;
  if (FALSE_TOKENS.has(normalized)) return false;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Use yes/no, y/n, true/false, ✅/❌",
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
