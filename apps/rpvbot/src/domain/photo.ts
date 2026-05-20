import type { ImageKind } from "./image.js";
import { stripControlChars } from "./sanitise.js";

/**
 * Builds the text token an image occupies in the `rpv_messages.text`
 * column AFTER the OCR cron has described it. The transcript renderer
 * (renderTranscript) then carries this into the resume / question /
 * souls prompts — so the bot becomes aware of what was shared.
 *
 * All inputs are user-influenced (caption, sticker emoji/set, and the
 * Gemini OCR/description of a user-supplied image), so every field is
 * control-char-stripped and length-capped here — the same injection
 * defence as formatStickerText. The token is additionally fenced by
 * fenceBody when it reaches a prompt.
 *
 * Photo  → "[photo: <description> | text in image: <ocr> | caption: "<cap>"]"
 * Sticker→ "[sticker 😭 from PepeReactions: <description> | text in image: <ocr>]"
 *          (the "😭 from PepeReactions" part comes from stickerMeta)
 *
 * Segments are omitted when their source is empty.
 */

const DESCRIPTION_MAX_CHARS = 600;
const OCR_MAX_CHARS = 1500;
const CAPTION_MAX_CHARS = 400;
const STICKER_META_MAX_CHARS = 120;

function clean(raw: string, maxChars: number): string {
  const stripped = stripControlChars(raw).replace(/\s+/g, " ").trim();
  return stripped.length > maxChars ? stripped.slice(0, maxChars) : stripped;
}

export interface FormatImageArgs {
  readonly kind: ImageKind;
  readonly description: string;
  readonly ocrText: string;
  /** Photo caption — "" for stickers / uncaptioned photos. */
  readonly caption: string;
  /** For stickers: the "😭 from PepeReactions" string. "" for photos. */
  readonly stickerMeta: string;
}

export function formatImageText(args: FormatImageArgs): string {
  const description = clean(args.description, DESCRIPTION_MAX_CHARS);
  const ocr = clean(args.ocrText, OCR_MAX_CHARS);
  const caption = clean(args.caption, CAPTION_MAX_CHARS);
  const stickerMeta = clean(args.stickerMeta, STICKER_META_MAX_CHARS);

  // Lead label. Stickers keep their emoji+set prefix; photos are plain.
  const lead =
    args.kind === "sticker"
      ? stickerMeta.length > 0
        ? `sticker ${stickerMeta}`
        : "sticker"
      : "photo";

  const segments: string[] = [];
  if (description.length > 0) segments.push(description);
  if (ocr.length > 0) segments.push(`text in image: ${ocr}`);
  if (caption.length > 0) segments.push(`caption: "${caption}"`);

  // No description and nothing else → a bare placeholder (the cron
  // hasn't run, or produced nothing). Still tells the model an image
  // was shared.
  if (segments.length === 0) return `[${lead}]`;
  return `[${lead}: ${segments.join(" | ")}]`;
}
