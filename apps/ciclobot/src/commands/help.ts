import type { BotContext } from "../context.js";

const HELP_TEXT = `🏋️ ciclobot — weekly 5×5 tracker

🚀 START HERE

1. /join — opt in (asks your height + weight)
2. /log bench 100 yes — your first lift
3. /weight 82.5 — your weekly body weight
4. /week — see the group's table

That's it. Re-log to overwrite. Sunday 19:00 the bot pings whoever's missing required entries.

📋 ALL COMMANDS

Logging
/log <lift> <kg> <done> — e.g. /log bench 100 yes
/weight <kg> — this week's body weight
/undo <lift|bodyweight> — delete this week's entry

Viewing
/week — this week, everyone
/history — your last 8 weeks
/history <lift> — filtered to one lift
/history bodyweight — your weekly bodyweight history
/participants — who's in the challenge

Membership
/join — opt in
/leave — opt out (history kept)
/cancel — abort a /join in progress

ℹ️ THE LIFTS

Required (reminded): bench, squat, deadlift
Optional (never reminded): clean_and_jerk, snatch

Type lift names exactly — no aliases. Weights are always kg. <done> accepts y/n, yes/no, true/false, ✅/❌.`;

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_TEXT);
}
