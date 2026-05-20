import { Buffer } from "node:buffer";
import type { Config } from "../config.js";
import { MAX_OCR_ATTEMPTS } from "../domain/cap.js";
import { summaryLanguage } from "../domain/day.js";
import {
  ImageOcrResultSchema,
  type ImageRecord,
  type ImageStatus,
} from "../domain/image.js";
import { decodeNewlines, encodeNewlines } from "../domain/message.js";
import { formatImageText } from "../domain/photo.js";
import type { GeminiTextClient } from "../gemini/text.js";
import {
  IMAGE_OCR_RESPONSE_SCHEMA,
  systemPromptForOcr,
  userPromptForOcr,
} from "../prompt/ocr.js";
import type { Services } from "../services.js";
import { downloadTelegramFile } from "../telegram/download.js";

/**
 * Pure helper: pick the images an OCR run should process. `pending`
 * rows, plus `failed` rows still under the retry cap, oldest first,
 * capped at `maxPerRun`. Exported for testing.
 */
export function selectPending(
  all: readonly ImageRecord[],
  maxPerRun: number,
): ImageRecord[] {
  return all
    .filter(
      (i) =>
        i.status === "pending" ||
        (i.status === "failed" && i.attempts < MAX_OCR_ATTEMPTS),
    )
    .sort((a, b) =>
      a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0,
    )
    .slice(0, maxPerRun);
}

export async function runOcrImages(
  services: Services,
  gemini: GeminiTextClient,
  config: Config,
): Promise<void> {
  const all = await services.images.listAll();
  const queue = selectPending(all, config.ocrMaxPerRun);
  if (queue.length === 0) {
    console.log("rpvbot: ocr — nothing pending");
    return;
  }
  console.log(`rpvbot: ocr — processing ${String(queue.length)} image(s)`);

  const language = summaryLanguage(new Date(), config.timeZone);
  let described = 0;
  let failed = 0;

  // Sequential — keeps Gemini + Telegram quota predictable.
  for (const image of queue) {
    // 1. Download the file.
    const download = await downloadTelegramFile({
      botToken: config.botToken,
      fileId: image.file_id,
      maxBytes: config.ocrMaxImageBytes,
    });
    if (!download.ok) {
      // `gone` / `too_big` are permanent — mark skipped, never retry.
      // `error` is transient — mark failed, retried until the cap.
      const status: ImageStatus =
        download.reason === "error" ? "failed" : "skipped";
      console.error(
        `rpvbot: ocr — download ${download.reason} for ${String(image.message_id)}: ${download.detail}`,
      );
      await persistFailure(services, image, status);
      failed += 1;
      continue;
    }

    // 2. Describe via Gemini vision.
    let raw: unknown;
    try {
      raw = await gemini.describeImage({
        system: systemPromptForOcr(language, image.kind),
        user: userPromptForOcr(language),
        image: {
          base64: Buffer.from(download.bytes).toString("base64"),
          mimeType: image.mime_type,
        },
        responseSchema: IMAGE_OCR_RESPONSE_SCHEMA,
        temperature: 0.2,
      });
    } catch (err) {
      console.error(
        `rpvbot: ocr — describe failed for ${String(image.message_id)}:`,
        err,
      );
      await persistFailure(services, image, "failed");
      failed += 1;
      continue;
    }
    const parsed = ImageOcrResultSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `rpvbot: ocr — invalid result for ${String(image.message_id)}: ${parsed.error.message}`,
      );
      await persistFailure(services, image, "failed");
      failed += 1;
      continue;
    }

    // 3. Mark the image done, and rewrite the linked message's text.
    const doneRecord: ImageRecord = {
      ...image,
      status: "done",
      description: parsed.data.description,
      ocr_text: parsed.data.ocr_text,
      processed_at: new Date().toISOString(),
    };
    try {
      await services.images.upsert(doneRecord);
      await rewriteMessageText(services, doneRecord);
      described += 1;
    } catch (err) {
      console.error(
        `rpvbot: ocr — persist failed for ${String(image.message_id)}:`,
        err,
      );
      failed += 1;
    }
  }

  console.log(
    `rpvbot: ocr — done: ${String(described)} described, ${String(failed)} failed`,
  );
}

async function persistFailure(
  services: Services,
  image: ImageRecord,
  status: ImageStatus,
): Promise<void> {
  // `attempts` counts RETRYABLE failures only — bump it for `failed`
  // (the cron will retry until MAX_OCR_ATTEMPTS), but not for `skipped`
  // (a permanent dead-end that selectPending never re-picks anyway).
  const record: ImageRecord = {
    ...image,
    status,
    attempts: status === "failed" ? image.attempts + 1 : image.attempts,
  };
  try {
    await services.images.upsert(record);
  } catch (err) {
    console.error(
      `rpvbot: ocr — could not record failure for ${String(image.message_id)}:`,
      err,
    );
  }
}

/**
 * Rewrite the linked `rpv_messages` row's text with the enriched
 * `[photo: …]` / `[sticker: …]` token. If the message row is gone
 * (pruned), there's nothing to update — that's fine, the image row
 * still carries the result.
 */
async function rewriteMessageText(
  services: Services,
  image: ImageRecord,
): Promise<void> {
  const message = await services.messages.findByKey(image.message_id);
  if (message === undefined) return;
  const token = formatImageText({
    kind: image.kind,
    description: image.description,
    ocrText: image.ocr_text,
    caption: decodeNewlines(image.caption),
    stickerMeta: image.sticker_meta,
  });
  await services.messages.upsert({
    ...message,
    text: encodeNewlines(token),
  });
}
