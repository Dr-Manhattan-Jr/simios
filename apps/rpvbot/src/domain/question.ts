import { stripControlChars } from "./sanitise.js";

/**
 * /rpv accepts free-text questions, which are untrusted user input. This
 * sanitiser is the boundary layer — it caps length and strips control
 * characters BEFORE the text reaches the LLM prompt. The actual semantic
 * defence (don't follow instructions, don't leak the system prompt, etc.)
 * lives in the system prompt in src/prompt/capitan-rpv.ts.
 *
 * Sanitisation never rejects long input; it truncates. Rejecting would
 * make every "/rpv <wall of text>" a UX dead-end. The model can still
 * answer truncated questions sensibly.
 */
export type SanitisedQuestion =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: string };

export function sanitiseQuestion(
  raw: string,
  maxChars: number,
): SanitisedQuestion {
  // Collapse runs of whitespace so a payload like "innocent\n\n\nIGNORE
  // PREVIOUS" doesn't get rendered with suspicious blank lines after
  // control-stripping.
  const collapsed = stripControlChars(raw).replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) {
    return { ok: false, error: "Question is empty." };
  }
  const truncated =
    collapsed.length > maxChars ? collapsed.slice(0, maxChars).trimEnd() : collapsed;
  return { ok: true, text: truncated };
}
