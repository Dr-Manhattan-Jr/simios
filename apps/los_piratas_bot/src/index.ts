import {
  onlyChat,
  startBotWith409Retry,
  startHealthServer,
} from "@simios/telegram-kit";
import { Bot } from "grammy";
import cron from "node-cron";
import { buildJoin } from "./commands/join.js";
import { buildLeave } from "./commands/leave.js";
import { loadConfig } from "./config.js";
import { FRIDAY_END, FRIDAY_START } from "./domain/announcements.js";
import { createCooldown } from "./domain/cooldown.js";
import { isFriday } from "./domain/day.js";
import { detectLanguage } from "./domain/language.js";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  modeForLanguage,
} from "./domain/prompt.js";
import { createGeminiTextClient } from "./gemini/text.js";
import { createServices } from "./services.js";

async function main(): Promise<void> {
  console.log("los_piratas_bot: validating environment…");
  const config = loadConfig();
  console.log(
    `los_piratas_bot: environment OK (chat ${String(config.chatId)}, ` +
      `tz ${config.timeZone}, cooldown ${String(config.cooldownSeconds)}s)`,
  );

  const services = await createServices(config);
  console.log(
    `los_piratas_bot: members loaded (${String(services.memberCache.size())} active)`,
  );

  const gemini = createGeminiTextClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  });
  const cooldown = createCooldown(config.cooldownSeconds * 1000);

  const bot = new Bot(config.botToken);
  bot.use(onlyChat(config.chatId));

  await bot.api.setMyCommands([
    { command: "join", description: "Join Pirate Day (only joined members are watched)" },
    { command: "leave", description: "Leave Pirate Day" },
  ]);

  bot.command("join", buildJoin(services));
  bot.command("leave", buildLeave(services));

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    // The bot's own messages never re-enter this handler (Telegram doesn't
    // deliver them as updates), so no self-loop guard is needed.

    // Bare commands like /help or /join are routed by grammY's command()
    // matchers above (or for unknown commands, ignored). Don't treat them
    // as natural-language to react to.
    if (text.trim().startsWith("/")) return;

    // Anonymous channel posts have no `from`. Skip them — we have no way to
    // address the speaker, and our cooldown is per-user.
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    // Opt-in gate: only joined members get watched. Non-members chat
    // freely without being insulted.
    if (!services.memberCache.has(userId)) return;

    if (!isFriday(new Date(), config.timeZone)) return;

    const language = detectLanguage(text);
    const mode = modeForLanguage(language);
    if (mode === undefined) return;

    if (!cooldown.tryFire(userId, Date.now())) return;

    const username = ctx.from?.username;
    const userPrompt = buildUserPrompt({
      mode,
      userMessage: text,
      username,
    });
    console.log(
      `los_piratas_bot: triggered (mode=${mode}, lang=${language}, user=${username ?? "anon"})`,
    );

    try {
      const reply = await gemini.generate({
        system: SYSTEM_PROMPT,
        user: userPrompt,
      });
      // Honor the "SKIP" sentinel from the system prompt: good English
      // doesn't deserve a reply.
      if (reply.trim().toUpperCase() === "SKIP") {
        console.log("los_piratas_bot: model said SKIP");
        return;
      }
      await ctx.reply(reply, {
        reply_parameters: { message_id: ctx.message.message_id },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("los_piratas_bot: generation failed:", message);
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  // Friday boundary announcements. node-cron pins them to wall-clock time
  // in the configured timezone, so they fire reliably regardless of when
  // the container restarted. The container needs to be alive at midnight
  // — Railway keeps long-poll workers running, so this is fine.
  cron.schedule(
    "0 0 * * 5",
    () => {
      bot.api.sendMessage(config.chatId, FRIDAY_START).catch((err: unknown) => {
        console.error("los_piratas_bot: friday start announcement failed:", err);
      });
    },
    { timezone: config.timeZone },
  );
  cron.schedule(
    "0 0 * * 6",
    () => {
      bot.api.sendMessage(config.chatId, FRIDAY_END).catch((err: unknown) => {
        console.error("los_piratas_bot: friday end announcement failed:", err);
      });
    },
    { timezone: config.timeZone },
  );

  let healthy = false;
  startHealthServer({ isHealthy: () => healthy });

  console.log(
    `los_piratas_bot starting — chat ${String(config.chatId)}, model ${config.geminiModel}`,
  );
  await startBotWith409Retry(bot, {
    label: "los_piratas_bot",
    onStart: () => {
      healthy = true;
      console.log("los_piratas_bot: long polling started");
    },
  });
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
