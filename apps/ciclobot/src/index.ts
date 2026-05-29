import {
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import {
  onlyChat,
  startBotWith409Retry,
  startHealthServer,
} from "@simios/telegram-kit";
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
import { buildHeight } from "./commands/height.js";
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
    { command: "log", description: "Log a lift or triathlon session: /log <lift> <kg> <made|missed> or /log <bike|swim|run> <km> <time>" },
    { command: "weight", description: "Log body weight: /weight <kg>" },
    { command: "height", description: "Update height: /height <cm>" },
    { command: "week", description: "Show this week's table" },
    { command: "history", description: "Show your last 8 weeks" },
    { command: "undo", description: "Undo this week's entry: /undo <lift|bodyweight|bike|swim|run>" },
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
  bot.command("height", buildHeight(services));
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

  // Flip to true after the bot's long poll is actually running.
  let healthy = false;
  startHealthServer({ isHealthy: () => healthy });

  console.log(
    `ciclobot starting — chat ${String(config.chatId)}, tz ${config.timeZone}`,
  );
  await startBotWith409Retry(bot, {
    label: "ciclobot",
    onStart: () => {
      healthy = true;
      console.log("ciclobot: long polling started");
    },
  });
}

main().catch((err: unknown) => {
  if (
    err !== null &&
    typeof err === "object" &&
    "error_code" in err &&
    err.error_code === 409
  ) {
    console.error(
      "Fatal: another ciclobot instance is already long-polling this token. " +
        "Stop the other one (local dev process, previous Railway deploy still draining, " +
        "or a second service using the same BOT_TOKEN) and this one will recover.",
    );
  } else {
    console.error("Fatal:", err);
  }
  process.exit(1);
});
