import { z } from "zod";

/** Which kind of shared image — drives the token prefix + the OCR prompt. */
export const ImageKindSchema = z.enum(["photo", "sticker"]);
export type ImageKind = z.infer<typeof ImageKindSchema>;

/**
 * Lifecycle of a captured image:
 *  - pending: captured, not yet OCR'd.
 *  - done:    OCR + description written back to the message.
 *  - failed:  a download/describe attempt failed; retried until
 *             MAX_OCR_ATTEMPTS, then left alone.
 *  - skipped: permanently un-processable (e.g. the Telegram file is
 *             gone for good) — never retried.
 */
export const ImageStatusSchema = z.enum([
  "pending",
  "done",
  "failed",
  "skipped",
]);
export type ImageStatus = z.infer<typeof ImageStatusSchema>;

/**
 * One row per shared image (photo or static sticker), stored on the
 * `rpv_images` tab. Keyed on `message_id` — the message that carried
 * the image. The hourly OCR cron picks up `pending` rows, downloads the
 * file, describes it via Gemini, and writes the result back into the
 * linked `rpv_messages` row's text.
 */
export const ImageRecordSchema = z.object({
  message_id: z.number().int().positive(),
  kind: ImageKindSchema,
  // The Telegram file_id to download (chosen PhotoSize, or sticker file).
  file_id: z.string().min(1),
  // image/jpeg for photos, image/webp for static stickers.
  mime_type: z.string().min(1),
  sent_at: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string().min(1),
  // Photo caption (newline-encoded), "" if none or for stickers.
  caption: z.string(),
  // For kind=sticker: the emoji + set-name string so the final token
  // keeps showing them. "" for photos.
  sticker_meta: z.string(),
  status: ImageStatusSchema,
  attempts: z.number().int().nonnegative(),
  // Gemini's outputs — empty until status=done.
  description: z.string(),
  ocr_text: z.string(),
  // When the cron finished it; "" while pending.
  processed_at: z.string(),
});
export type ImageRecord = z.infer<typeof ImageRecordSchema>;

/**
 * The shape Gemini must return for an image: a short description and any
 * text visible in the image. Used to zod-validate the model output (the
 * Gemini responseSchema only improves the odds of valid JSON).
 */
export const ImageOcrResultSchema = z.object({
  description: z.string(),
  ocr_text: z.string(),
});
export type ImageOcrResult = z.infer<typeof ImageOcrResultSchema>;
