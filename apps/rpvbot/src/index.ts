import {
  onlyChat,
  startBotWith409Retry,
  startHealthServer,
} from "@simios/telegram-kit";
import { Bot } from "grammy";
import cron from "node-cron";
import { buildRpv } from "./commands/rpv.js";
import { loadConfig } from "./config.js";
import { runDailyResume } from "./crons/daily-resume.js";
import { runDailySouls } from "./crons/daily-souls.js";
import { runOcrImages } from "./crons/ocr-images.js";
import { runPrune } from "./crons/prune-messages.js";
import {
  createCooldown,
  createUserCooldown,
} from "./domain/cooldown.js";
import type { ImageKind, ImageRecord } from "./domain/image.js";
import { encodeNewlines, type MessageRecord } from "./domain/message.js";
import { formatImageText } from "./domain/photo.js";
import { formatStickerText } from "./domain/sticker.js";
import { createGeminiTextClient } from "./gemini/text.js";
import { createServices, type Services } from "./services.js";

function buildMessageRecord(args: {
  readonly messageId: number;
  readonly dateUnix: number;
  readonly text: string;
  readonly from: { id: number; first_name: string; username?: string };
  readonly replyToId: number;
}): MessageRecord {
  const base = {
    message_id: args.messageId,
    sent_at: new Date(args.dateUnix * 1000).toISOString(),
    user_id: args.from.id,
    first_name: args.from.first_name,
    text: encodeNewlines(args.text),
    reply_to_id: args.replyToId,
  };
  return args.from.username !== undefined && args.from.username.length > 0
    ? { ...base, username: args.from.username }
    : base;
}

function persistMessage(services: Services, record: MessageRecord): void {
  services.messages.upsert(record).catch((err: unknown) => {
    console.error("rpvbot: message persist failed:", err);
  });
}

/**
 * Append a `pending` row to rpv_images for the hourly OCR cron to pick
 * up. Fire-and-forget — a failed write just means that image isn't
 * OCR'd; its rpv_messages placeholder still stands.
 */
function appendPendingImage(
  services: Services,
  args: {
    readonly messageId: number;
    readonly kind: ImageKind;
    readonly fileId: string;
    readonly mimeType: string;
    readonly dateUnix: number;
    readonly from: { id: number; first_name: string; username?: string };
    readonly caption: string;
    readonly stickerMeta: string;
  },
): void {
  const base = {
    message_id: args.messageId,
    kind: args.kind,
    file_id: args.fileId,
    mime_type: args.mimeType,
    sent_at: new Date(args.dateUnix * 1000).toISOString(),
    user_id: args.from.id,
    first_name: args.from.first_name,
    caption: encodeNewlines(args.caption),
    sticker_meta: args.stickerMeta,
    status: "pending" as const,
    attempts: 0,
    description: "",
    ocr_text: "",
    processed_at: "",
  };
  const record: ImageRecord =
    args.from.username !== undefined && args.from.username.length > 0
      ? { ...base, username: args.from.username }
      : base;
  services.images.upsert(record).catch((err: unknown) => {
    console.error("rpvbot: image capture failed:", err);
  });
}

/**
 * From a Telegram `photo` array (resolutions of one image, ascending
 * by size) pick the file_id of the largest resolution whose reported
 * `file_size` is under the cap. Falls back to the largest by pixel
 * area when sizes are absent — the OCR cron re-checks `file_size`
 * before downloading.
 */
function pickPhotoFileId(
  photo: readonly {
    file_id: string;
    file_size?: number;
    width: number;
    height: number;
  }[],
  maxBytes: number,
): string | undefined {
  const underCap = photo.filter(
    (p) => p.file_size === undefined || p.file_size <= maxBytes,
  );
  const pool = underCap.length > 0 ? underCap : photo;
  let best: (typeof photo)[number] | undefined;
  for (const p of pool) {
    if (best === undefined || p.width * p.height > best.width * best.height) {
      best = p;
    }
  }
  return best?.file_id;
}

async function main(): Promise<void> {
  console.log("rpvbot: validating environment…");
  const config = loadConfig();
  console.log(
    `rpvbot: environment OK (chat ${String(config.chatId)}, tz ${config.timeZone})`,
  );

  const services = await createServices(config);

  const gemini = createGeminiTextClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  });

  const bot = new Bot(config.botToken);
  bot.use(onlyChat(config.chatId));

  await bot.api.setMyCommands([
    {
      command: "rpv",
      description: "Summarise last N messages, or ask a question",
    },
  ]);

  const groupCooldown = createCooldown(config.rpvGroupCooldownSeconds * 1000);
  const userCooldown = createUserCooldown(config.rpvUserCooldownSeconds * 1000);
  bot.command(
    "rpv",
    buildRpv({ services, gemini, config, groupCooldown, userCooldown }),
  );

  bot.on("message:text", (ctx) => {
    const text = ctx.message.text;

    // Slash commands are routed by bot.command() above; we don't archive
    // them because they're never the content the chronicler should summarise.
    if (text.trim().startsWith("/")) return;

    // Anonymous channel posts have no `from`. Skip — we have no author
    // to attribute, and our schema requires user fields.
    const from = ctx.from;
    if (from === undefined) return;

    persistMessage(
      services,
      buildMessageRecord({
        messageId: ctx.message.message_id,
        dateUnix: ctx.message.date,
        text,
        from,
        replyToId: ctx.message.reply_to_message?.message_id ?? 0,
      }),
    );
  });

  // Stickers don't fire "message:text". We render them as a short text
  // token like "[sticker 😭 from PepeReactions]" so summaries, questions,
  // and souls see *something* about the sticker. Static (.webp) stickers
  // are ALSO captured for OCR — the cron later enriches the token with a
  // description. Animated (.tgs) / video (.webm) stickers stay token-only
  // (they aren't still images Gemini can read).
  bot.on("message:sticker", (ctx) => {
    const from = ctx.from;
    if (from === undefined) return;
    const sticker = ctx.message.sticker;
    const stickerMeta = formatStickerText({
      ...(sticker.emoji !== undefined ? { emoji: sticker.emoji } : {}),
      ...(sticker.set_name !== undefined
        ? { set_name: sticker.set_name }
        : {}),
    });
    persistMessage(
      services,
      buildMessageRecord({
        messageId: ctx.message.message_id,
        dateUnix: ctx.message.date,
        text: stickerMeta,
        from,
        replyToId: ctx.message.reply_to_message?.message_id ?? 0,
      }),
    );
    // Only static .webp stickers can be OCR'd.
    if (sticker.is_animated || sticker.is_video) return;
    appendPendingImage(services, {
      messageId: ctx.message.message_id,
      kind: "sticker",
      fileId: sticker.file_id,
      mimeType: "image/webp",
      dateUnix: ctx.message.date,
      from,
      caption: "",
      // The "😭 from PepeReactions" string — formatStickerText wraps it
      // in "[sticker …]"; strip that wrapper so the OCR token builder
      // can re-wrap it. (The brackets/word are fixed, so slice is safe.)
      stickerMeta: stickerMeta.replace(/^\[sticker /, "").replace(/\]$/, ""),
    });
  });

  // Photos: capture a pending rpv_images row + a placeholder rpv_messages
  // row so the photo holds its chronological slot immediately. The hourly
  // OCR cron downloads + describes it and rewrites the message text.
  bot.on("message:photo", (ctx) => {
    const from = ctx.from;
    if (from === undefined) return;
    const caption = ctx.message.caption ?? "";
    const fileId = pickPhotoFileId(
      ctx.message.photo,
      config.ocrMaxImageBytes,
    );
    // Placeholder message text — "[photo]" or "[photo: caption: …]" via
    // the same token builder the cron uses, so it's consistent and the
    // caption is control-char stripped + capped.
    const placeholder = formatImageText({
      kind: "photo",
      description: "",
      ocrText: "",
      caption,
      stickerMeta: "",
    });
    persistMessage(
      services,
      buildMessageRecord({
        messageId: ctx.message.message_id,
        dateUnix: ctx.message.date,
        text: placeholder,
        from,
        replyToId: ctx.message.reply_to_message?.message_id ?? 0,
      }),
    );
    if (fileId === undefined) {
      console.warn(
        `rpvbot: photo ${String(ctx.message.message_id)} had no usable size`,
      );
      return;
    }
    appendPendingImage(services, {
      messageId: ctx.message.message_id,
      kind: "photo",
      fileId,
      mimeType: "image/jpeg",
      dateUnix: ctx.message.date,
      from,
      caption,
      stickerMeta: "",
    });
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  // "off" is the sentinel for "don't schedule this cron at all" — useful
  // in dev to silence a specific job without commenting code out. Empty
  // strings would crash node-cron at boot, hence the zod NonEmptyString
  // default in config.ts; the explicit "off" path is the only way to
  // disable from env.
  function scheduleIfEnabled(spec: string, label: string, fn: () => void): void {
    if (spec === "off") {
      console.log(`rpvbot: ${label} cron disabled (${spec})`);
      return;
    }
    cron.schedule(spec, fn, { timezone: config.timeZone });
  }

  scheduleIfEnabled(config.dailyResumeCron, "daily resume", () => {
    runDailyResume(bot, services, gemini, config).catch((err: unknown) => {
      console.error("rpvbot: daily resume failed:", err);
    });
  });

  scheduleIfEnabled(config.soulsCron, "souls", () => {
    runDailySouls(services, gemini, config).catch((err: unknown) => {
      console.error("rpvbot: souls cron failed:", err);
    });
  });

  scheduleIfEnabled(config.ocrCron, "ocr", () => {
    runOcrImages(services, gemini, config).catch((err: unknown) => {
      console.error("rpvbot: ocr cron failed:", err);
    });
  });

  scheduleIfEnabled(config.pruneCron, "prune", () => {
    runPrune(services, config).catch((err: unknown) => {
      console.error("rpvbot: prune failed:", err);
    });
  });

  let healthy = false;
  startHealthServer({ isHealthy: () => healthy });

  console.log(
    `rpvbot starting — chat ${String(config.chatId)}, model ${config.geminiModel}, daily ${config.dailyResumeCron}, souls ${config.soulsCron}, ocr ${config.ocrCron} ${config.timeZone}`,
  );
  await startBotWith409Retry(bot, {
    label: "rpvbot",
    onStart: () => {
      healthy = true;
      console.log("rpvbot: long polling started");
    },
  });
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
