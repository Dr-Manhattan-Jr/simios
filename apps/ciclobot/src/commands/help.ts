import type { BotContext } from "../context.js";

const HELP_TEXT = `🏋️ ciclobot — weekly 5×5 tracker

🚀 START HERE

1. /join — opt in (asks your height + weight)
2. /log bench 100 made — your first lift
3. /weight 82.5 — your weekly body weight
4. /height 178 — update your height
5. /week — see the group's table

That's it. Re-log to overwrite. Sunday 19:00 the bot pings whoever's missing required entries.

📋 ALL COMMANDS

Logging
/log <lift> <kg> <made|missed> — e.g. /log bench 100 made
/log <bike|swim|run> <km> <time> — e.g. /log bike 40 1:05:00
/weight <kg> — this week's body weight
/height <cm> — update your height
/undo <lift|bodyweight|bike|swim|run> — delete this week's entry

"made" = you hit all 5 sets × 5 reps cleanly.
"missed" = you failed any rep (5×3 instead of 5×5, missed reps in the last set, etc.).
y/n, yes/no, ✅/❌ also accepted.

Triathlon sessions are append-only: log as many bike/swim/run sessions per week as you like. Distance is always km (swim too, e.g. 1.5). Time accepts HH:MM:SS (1:05:00), MM:SS (52:30), or minutes (52m). Velocity (km/h) is computed for you. /undo bike removes your latest bike session this week.

Viewing
/week — this week, everyone
/history — your last 8 weeks
/history <lift> — filtered to one lift
/history <bike|swim|run> — your recent sessions for that discipline
/history bodyweight — your weekly bodyweight history
/participants — who's in the challenge

Membership
/join — opt in
/leave — opt out (history kept)
/cancel — abort a /join in progress

ℹ️ THE LIFTS

Required (reminded): bench, squat, deadlift
Optional (never reminded): clean_and_jerk, snatch

Type lift names exactly — no aliases. Weights are always kg.`;

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_TEXT);
}
