/**
 * Shared text-sanitisation primitives. Used by:
 *  - sanitiseQuestion (user-supplied /rpv question text)
 *  - formatStickerText (Telegram sticker emoji + set_name, which are
 *    user-influenced at sticker-creation time)
 *
 * Anywhere user-controlled text flows into an LLM prompt or a sheet
 * cell, strip control chars first.
 */

// Strip ASCII control chars (\x00-\x1F, \x7F) and Unicode bidi/format
// controls — zero-width spaces (U+200B–U+200F), bidi overrides
// (U+202A–U+202E), isolate marks (U+2066–U+2069), BOM (U+FEFF). Built
// from a string with explicit \u escapes so the source file stays
// readable and round-trips cleanly through tooling.
const CONTROL_CHAR_RE = new RegExp(
  "[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]",
  "g",
);

/** Replace control characters with a space; does not collapse whitespace. */
export function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHAR_RE, " ");
}
