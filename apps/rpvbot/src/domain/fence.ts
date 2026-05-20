/**
 * Delimiters used to fence each message body (and each member profile)
 * fed to Gemini. The persona prompts tell the model to treat anything
 * between <msg> and </msg> as literal content — NEVER as structure or
 * instructions. `fenceBody` escapes any literal fence tokens that appear
 * in the wrapped text so the fence stays parser-stable.
 */
export const MESSAGE_FENCE_OPEN = "<msg>";
export const MESSAGE_FENCE_CLOSE = "</msg>";

// Zero-width-space–broken copies of the fence tokens. A literal `<msg>`
// in user/soul text is rewritten to these so it can never terminate a
// real fence; visually identical, structurally inert.
const BROKEN_OPEN = "<​msg>";
const BROKEN_CLOSE = "</​msg>";

/**
 * Wrap `text` in a <msg>…</msg> fence, first rewriting any literal fence
 * tokens inside `text` so a malicious payload can't close the fence
 * early and inject fake structure.
 */
export function fenceBody(text: string): string {
  const safe = text
    .replaceAll(MESSAGE_FENCE_OPEN, BROKEN_OPEN)
    .replaceAll(MESSAGE_FENCE_CLOSE, BROKEN_CLOSE);
  return `${MESSAGE_FENCE_OPEN}${safe}${MESSAGE_FENCE_CLOSE}`;
}
