import { stripControlChars } from "./sanitise.js";

/**
 * Render a Telegram sticker as a short text token that can be stored in
 * the `text` column of rpv_messages alongside real text messages. The
 * model summarising/answering downstream sees something like
 * "[sticker 😭 from PepeReactions]" and can reason about which sticker
 * was sent without needing the actual file.
 *
 * Telegram sticker emoji and set_name are user-influenced at sticker-
 * creation time and can contain zero-width joiners, RTL overrides, or
 * control chars. We strip those before formatting so a malicious sticker
 * set can't inject prompt structure into the transcript.
 */
export interface StickerLike {
  readonly emoji?: string;
  readonly set_name?: string;
}

// Conservative cap on set name length. Telegram limits set names to
// ~64 chars at creation, but defence-in-depth: never trust the wire.
const SET_NAME_MAX_CHARS = 64;
// Emoji defensively capped — a single emoji is at most a few code units
// (rarely more with ZWJ sequences), so 32 is plenty even for compound
// emoji and trims any sneaky padding.
const EMOJI_MAX_CHARS = 32;

function cleanField(raw: string | undefined, maxChars: number): string {
  if (raw === undefined) return "";
  const stripped = stripControlChars(raw).replace(/\s+/g, " ").trim();
  if (stripped.length === 0) return "";
  return stripped.length > maxChars ? stripped.slice(0, maxChars) : stripped;
}

export function formatStickerText(sticker: StickerLike): string {
  const emoji = cleanField(sticker.emoji, EMOJI_MAX_CHARS) || "🖼";
  const set = cleanField(sticker.set_name, SET_NAME_MAX_CHARS);
  if (set.length > 0) {
    return `[sticker ${emoji} from ${set}]`;
  }
  return `[sticker ${emoji}]`;
}
