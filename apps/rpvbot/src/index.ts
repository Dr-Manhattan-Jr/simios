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
import { runPrune } from "./crons/prune-messages.js";
import {
  createCooldown,
  createUserCooldown,
} from "./domain/cooldown.js";
import { encodeNewlines, type MessageRecord } from "./domain/message.js";
import { createGeminiTextClient } from "./gemini/text.js";
import { createServices } from "./services.js";

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
      description: `Resume the last N messages (default ${String(config.rpvDefaultN)})`,
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

    // Persist the message. Key is per-chat unique, so upsert is naturally
    // idempotent if Telegram redelivers (no dedup ring needed).
    const record: MessageRecord = {
      message_id: ctx.message.message_id,
      sent_at: new Date(ctx.message.date * 1000).toISOString(),
      user_id: from.id,
      first_name: from.first_name,
      text: encodeNewlines(text),
      reply_to_id: ctx.message.reply_to_message?.message_id ?? 0,
      ...(from.username !== undefined && from.username.length > 0
        ? { username: from.username }
        : {}),
    };
    services.messages.upsert(record).catch((err: unknown) => {
      console.error("rpvbot: message persist failed:", err);
    });
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  cron.schedule(
    config.dailyResumeCron,
    () => {
      runDailyResume(bot, services, gemini, config).catch((err: unknown) => {
        console.error("rpvbot: daily resume failed:", err);
      });
    },
    { timezone: config.timeZone },
  );

  cron.schedule(
    config.pruneCron,
    () => {
      runPrune(services, config).catch((err: unknown) => {
        console.error("rpvbot: prune failed:", err);
      });
    },
    { timezone: config.timeZone },
  );

  let healthy = false;
  startHealthServer({ isHealthy: () => healthy });

  console.log(
    `rpvbot starting — chat ${String(config.chatId)}, model ${config.geminiModel}, daily ${config.dailyResumeCron} ${config.timeZone}`,
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
