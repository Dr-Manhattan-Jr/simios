import { parseTelegramUser } from "@simios/telegram-kit";
import { withOptional } from "@simios/sheets-client";
import type { BotContext, BotConversation, ConvContext } from "../context.js";
import type { Services } from "../services.js";
import { shapeJoke } from "../domain/bmi-joke.js";
import { CmSchema, KgSchema } from "../domain/parse.js";
import {
  BodyweightKgSchema,
  HeightCmSchema,
  type Participant,
} from "../domain/participant.js";
import { currentIsoWeek, currentWeekStart } from "../domain/week.js";

export const JOIN_CONVERSATION = "join";

export function buildJoinConversation(services: Services) {
  return async function join(
    conversation: BotConversation,
    ctx: ConvContext,
  ): Promise<void> {
    const user = parseTelegramUser(ctx);
    if (user === undefined) {
      await ctx.reply("Cannot identify you. Please try again.");
      return;
    }

    const existing = await conversation.external(() =>
      services.participants.findByKey(user.user_id),
    );

    let heightCm: number;
    if (existing !== undefined) {
      heightCm = existing.height_cm;
      await ctx.reply(
        `Welcome back, ${user.first_name}. Height already on file: ${String(heightCm)} cm.`,
      );
    } else {
      heightCm = await askHeight(conversation, ctx);
      await ctx.reply(`Got it — ${String(heightCm)} cm. One more question…`);
    }

    const weightKg = await askWeight(conversation, ctx);

    const now = new Date();
    const nowIso = now.toISOString();
    const timeZone = services.config.timeZone;
    const isoWeek = currentIsoWeek(now, timeZone);
    const weekStart = currentWeekStart(now, timeZone);

    const participantBase = {
      user_id: user.user_id,
      height_cm: heightCm,
      joined_at: existing?.joined_at ?? nowIso,
    };
    const participant: Participant = withOptional(
      participantBase,
      "username",
      user.username,
    );

    await conversation.external(() => services.participants.upsert(participant));

    const bwBase = {
      iso_week: isoWeek,
      week_start: weekStart,
      user_id: user.user_id,
      weight_kg: weightKg,
      logged_at: nowIso,
    };
    const bwEntry = withOptional(bwBase, "username", user.username);

    await conversation.external(() => services.bodyweight.upsert(bwEntry));

    const joke = shapeJoke(heightCm, weightKg, user.user_id);
    await ctx.reply(
      `✅ You're in, ${user.first_name}.\n` +
        `Height ${String(heightCm)} cm · weight ${String(weightKg)} kg.\n\n` +
        `${joke.line}\n\n` +
        `Now log something: /log bench 100 yes`,
    );
  };
}

async function askHeight(
  conversation: BotConversation,
  ctx: ConvContext,
): Promise<number> {
  await ctx.reply(
    "What's your height? Please answer in centimetres (cm) — e.g. 178.",
  );
  for (;;) {
    const update = await conversation.wait();
    const text = update.message?.text;
    if (text === undefined) {
      await update.reply("Please answer with a number in centimetres.");
      continue;
    }
    if (text.trim().toLowerCase() === "/cancel") {
      await update.reply("Cancelled.");
      await conversation.halt();
    }
    const num = CmSchema.safeParse(text);
    if (!num.success) {
      await update.reply(
        "I couldn't read that as a number. Please use centimetres — e.g. 178.",
      );
      continue;
    }
    const validated = HeightCmSchema.safeParse(num.data);
    if (!validated.success) {
      if (num.data > 0 && num.data < 3) {
        await update.reply("Please use centimetres, not metres — e.g. 178.");
      } else {
        await update.reply(
          "Out of range. Please give a height between 100 and 250 cm.",
        );
      }
      continue;
    }
    return validated.data;
  }
}

async function askWeight(
  conversation: BotConversation,
  ctx: ConvContext,
): Promise<number> {
  await ctx.reply(
    "What's your current body weight? Please answer in kilograms (kg) — e.g. 82.5.",
  );
  for (;;) {
    const update = await conversation.wait();
    const text = update.message?.text;
    if (text === undefined) {
      await update.reply("Please answer with a number in kilograms.");
      continue;
    }
    if (text.trim().toLowerCase() === "/cancel") {
      await update.reply("Cancelled.");
      await conversation.halt();
    }
    const num = KgSchema.safeParse(text);
    if (!num.success) {
      await update.reply(
        "I couldn't read that as a number. Please use kilograms — e.g. 82.5.",
      );
      continue;
    }
    const validated = BodyweightKgSchema.safeParse(num.data);
    if (!validated.success) {
      await update.reply(
        "Out of range. Please give a body weight between 30 and 300 kg.",
      );
      continue;
    }
    return validated.data;
  }
}

export function buildEnterJoin(_services: Services) {
  return async function enterJoin(ctx: BotContext): Promise<void> {
    await ctx.conversation.enter(JOIN_CONVERSATION);
  };
}
