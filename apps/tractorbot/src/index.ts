import { onlyChat } from "@simios/telegram-kit";
import { Bot, InputFile } from "grammy";
import { loadConfig } from "./config.js";
import { createGeminiImageClient } from "./gemini/image.js";
import { buildPromptParts, renderPrompt } from "./domain/prompt.js";
import { matchesTrigger } from "./domain/trigger.js";

async function main(): Promise<void> {
  console.log("tractorbot: validating environment…");
  const config = loadConfig();
  console.log(
    `tractorbot: environment OK (chat ${String(config.chatId)}, ` +
      `triggers ${config.triggerWords.join("/")}, cooldown ${String(config.cooldownSeconds)}s)`,
  );

  const gemini = createGeminiImageClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  });

  const bot = new Bot(config.botToken);
  bot.use(onlyChat(config.chatId));

  let lastFiredAt = 0;
  let inFlight = false;

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (!matchesTrigger(text, config.triggerWords)) return;

    const now = Date.now();
    if (now - lastFiredAt < config.cooldownSeconds * 1000) return;
    if (inFlight) return;
    lastFiredAt = now;
    inFlight = true;

    const parts = buildPromptParts();
    const prompt = renderPrompt(parts);
    console.log(`tractorbot: triggered, prompt="${prompt}"`);

    try {
      await ctx.replyWithChatAction("upload_photo");
      const image = await gemini.generate(prompt);
      await ctx.replyWithPhoto(new InputFile(image.bytes, "tractor.png"), {
        caption: `🐒🚜 ${parts.style}`,
        reply_parameters: { message_id: ctx.message.message_id },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("tractorbot: generation failed:", message);
    } finally {
      inFlight = false;
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  console.log(
    `tractorbot starting — chat ${String(config.chatId)}, model ${config.geminiModel}`,
  );
  await bot.start();
}

main().catch((err: unknown) => {
  if (
    err !== null &&
    typeof err === "object" &&
    "error_code" in err &&
    err.error_code === 409
  ) {
    console.error(
      "Fatal: another tractorbot instance is already long-polling this token. " +
        "Stop the other one (local dev process, previous Railway deploy still draining, " +
        "or a second service using the same BOT_TOKEN) and this one will recover.",
    );
  } else {
    console.error("Fatal:", err);
  }
  process.exit(1);
});
