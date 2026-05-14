import {
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { onlyChat } from "@simios/telegram-kit";
import { Bot } from "grammy";
import cron from "node-cron";
import { loadConfig } from "./config.js";
import { createServices, ensureSheetsReady } from "./services.js";
import type { BotContext } from "./context.js";
import { handleHelp } from "./commands/help.js";
import {
  JOIN_CONVERSATION,
  buildEnterJoin,
  buildJoinConversation,
} from "./commands/join.js";
import { buildLeave } from "./commands/leave.js";
import { buildParticipants } from "./commands/participants.js";
import { buildLog } from "./commands/log.js";
import { buildWeight } from "./commands/weight.js";
import { buildWeek } from "./commands/week.js";
import { buildHistory } from "./commands/history.js";
import { buildUndo } from "./commands/undo.js";
import { runReminder } from "./reminder.js";

async function main(): Promise<void> {
  console.log("ciclobot: validating environment…");
  const config = loadConfig();
  console.log(
    `ciclobot: environment OK (chat ${String(config.chatId)}, tz ${config.timeZone})`,
  );
  const services = createServices(config);

  await ensureSheetsReady(services);

  const bot = new Bot<BotContext>(config.botToken);
  bot.use(onlyChat(config.chatId));
  bot.use(conversations());
  bot.use(
    createConversation(buildJoinConversation(services), JOIN_CONVERSATION),
  );

  await bot.api.setMyCommands([
    { command: "join", description: "Enter the challenge" },
    { command: "leave", description: "Leave the challenge" },
    { command: "log", description: "Log a lift: /log <lift> <kg> <done>" },
    { command: "weight", description: "Log body weight: /weight <kg>" },
    { command: "week", description: "Show this week's table" },
    { command: "history", description: "Show your last 8 weeks" },
    { command: "undo", description: "Undo this week's entry: /undo <lift|bodyweight>" },
    { command: "participants", description: "List active participants" },
    { command: "cancel", description: "Cancel an in-progress flow" },
    { command: "help", description: "How the bot works" },
  ]);

  bot.command("help", handleHelp);
  bot.command("join", buildEnterJoin(services));
  bot.command("leave", buildLeave(services));
  bot.command("participants", buildParticipants(services));
  bot.command("log", buildLog(services));
  bot.command("weight", buildWeight(services));
  bot.command("week", buildWeek(services));
  bot.command("history", buildHistory(services));
  bot.command("undo", buildUndo(services));

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  cron.schedule(
    "0 19 * * 0",
    () => {
      runReminder(bot, services).catch((err: unknown) => {
        console.error("Reminder failed:", err);
      });
    },
    { timezone: config.timeZone },
  );

  console.log(
    `ciclobot starting — chat ${String(config.chatId)}, tz ${config.timeZone}`,
  );
  await bot.start();
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
