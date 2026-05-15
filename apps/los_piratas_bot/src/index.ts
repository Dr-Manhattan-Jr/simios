import {
  onlyChat,
  startBotWith409Retry,
  startHealthServer,
} from "@simios/telegram-kit";
import { Bot } from "grammy";
import { loadConfig } from "./config.js";
import { createCooldown } from "./domain/cooldown.js";
import { isFriday } from "./domain/day.js";
import { detectLanguage } from "./domain/language.js";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  modeForLanguage,
} from "./domain/prompt.js";
import { createGeminiTextClient } from "./gemini/text.js";

async function main(): Promise<void> {
  console.log("los_piratas_bot: validating environment…");
  const config = loadConfig();
  console.log(
    `los_piratas_bot: environment OK (chat ${String(config.chatId)}, ` +
      `tz ${config.timeZone}, cooldown ${String(config.cooldownSeconds)}s)`,
  );

  const gemini = createGeminiTextClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  });
  const cooldown = createCooldown(config.cooldownSeconds * 1000);

  const bot = new Bot(config.botToken);
  bot.use(onlyChat(config.chatId));

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    // The bot's own messages never re-enter this handler (Telegram doesn't
    // deliver them as updates), so no self-loop guard is needed.

    if (!isFriday(new Date(), config.timeZone)) return;

    const language = detectLanguage(text);
    const mode = modeForLanguage(language);
    if (mode === undefined) return;

    // Bare commands like /help or /weight shouldn't be reinterpreted by us
    // even on Friday — they're for other bots in the group.
    if (text.trim().startsWith("/")) return;

    if (!cooldown.tryFire(Date.now())) return;

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
