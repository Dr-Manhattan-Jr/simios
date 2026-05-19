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
import { runPrune } from "./crons/prune-messages.js";
import {
  createCooldown,
  createUserCooldown,
} from "./domain/cooldown.js";
import { encodeNewlines, type MessageRecord } from "./domain/message.js";
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

  // Stickers don't fire "message:text", so without this they'd silently
  // vanish from rpv_messages. We render them as a short text token like
  // "[sticker 😭 from PepeReactions]" so summaries, questions, and souls
  // all see *something* about the sticker without needing a media column.
  bot.on("message:sticker", (ctx) => {
    const from = ctx.from;
    if (from === undefined) return;
    const text = formatStickerText({
      ...(ctx.message.sticker.emoji !== undefined
        ? { emoji: ctx.message.sticker.emoji }
        : {}),
      ...(ctx.message.sticker.set_name !== undefined
        ? { set_name: ctx.message.sticker.set_name }
        : {}),
    });
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

  scheduleIfEnabled(config.pruneCron, "prune", () => {
    runPrune(services, config).catch((err: unknown) => {
      console.error("rpvbot: prune failed:", err);
    });
  });

  let healthy = false;
  startHealthServer({ isHealthy: () => healthy });

  console.log(
    `rpvbot starting — chat ${String(config.chatId)}, model ${config.geminiModel}, daily ${config.dailyResumeCron}, souls ${config.soulsCron} ${config.timeZone}`,
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
