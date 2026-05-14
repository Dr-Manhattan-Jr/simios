import type { BotContext } from "../context.js";

const HELP_TEXT = `ciclobot — weekly 5x5 weightlifting tracker

How it works
Each week (Mon–Sun) every participant logs their working weight (kg) and whether they completed all 5 sets, for each lift. Body weight is logged once per week too. On Sunday at 19:00 (Europe/Madrid) the bot pings anyone still missing required entries.

Tracked lifts
- Required (you'll be reminded): bench, squat, deadlift
- Optional (logged but never reminded): clean_and_jerk, snatch

Getting started
/join — opt in. The bot will ask for your height (cm) and current body weight (kg). Re-joining after /leave skips the height question.
/leave — opt out. Past entries are kept; you stop being pinged.
/cancel — abort an in-progress /join.

Logging
/log <lift> <weight> <done> — e.g. /log bench 100 yes
  • lift must be exactly: bench, squat, deadlift, clean_and_jerk, snatch (no aliases)
  • weight is in kg; "100" or "100kg" both work
  • done accepts y/n, yes/no, true/false, ✅/❌
  • Re-logging the same lift in the same week overwrites the prior entry.
/weight <kg> — log this week's body weight, e.g. /weight 82.5 (overwrites prior weight for the week)
/undo <lift|bodyweight> — delete this week's entry for that lift (or your bodyweight)

Viewing
/week — current week's table for all active participants
/history — your last 8 weeks across all lifts and bodyweight
/history <lift> — same, filtered to one lift
/history bodyweight — your weekly bodyweight history
/participants — list active participants and their height

Notes
- Weight is always in kilograms.
- Each command must come from inside this group; DMs are ignored.
- The Sunday reminder only nags about missing required lifts and bodyweight.`;

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_TEXT);
}
