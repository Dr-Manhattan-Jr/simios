# los_piratas_bot

Telegram bot that enforces "English Friday" in a Spanish-speaking group. On Fridays (Europe/Madrid time), the bot watches text messages and:

- **insults anyone writing in Spanish** with the voice of a drunken pirate sailor under Don Blas de Lezo, complete with historical jabs at the perfidious Albion;
- **corrects bad English** in character ("listen, you scurvy dog — it's *I have been* not *I have being*");
- **stays silent on weekdays** and **stays silent on good English**, so it isn't a nuisance.

Per-user cooldown of 30 seconds (configurable): each member has their own clock, so one chatty user doesn't suppress everyone else's mockery.

At Friday 00:00 local time the bot announces "Pirate Day begins!" in the configured group, and at Saturday 00:00 it announces the end.

## How it decides

1. Is the chat the configured group? (`onlyChat` middleware.)
2. Is today Friday in `Europe/Madrid`? If not, drop.
3. Detect the message language with `tinyld` (offline, no API call).
4. Spanish → insult mode. English → correction mode. Anything else → drop.
5. Cooldown gate: at most one fire per `COOLDOWN_SECONDS` (default 60).
6. Call Gemini 2.5 Flash with a system prompt that defines the persona and either modus operandi.
7. If the model returns `SKIP` (its sentinel for "this English is fine"), the bot stays quiet.

## Manual setup

1. **Create the Telegram bot.** Same flow as ciclobot: BotFather → `/newbot` → name it, e.g. `Los Piratas`, username `lospiratas_bot`. Copy the HTTP API token.
2. **Add the bot to your group.** It does **not** need admin rights.
3. **Get the group's chat ID.** Easiest path: temporarily run `los_piratas_bot` with the wrong `CHAT_ID` and read the `onlyChat: dropping update from chat -100…` log line — that's your real ID.
4. **Get a Gemini API key.** [Google AI Studio](https://aistudio.google.com/apikey) → Create API key. Free tier is generous (1500 req/day).
5. **Set Railway env vars** for the `los_piratas_bot` service:
   - `BOT_TOKEN` — from BotFather.
   - `CHAT_ID` — the negative chat ID (supergroups need the `-100` prefix).
   - `GEMINI_API_KEY` — from AI Studio.
   - `GEMINI_MODEL` — defaults to `gemini-2.5-flash`. Override if you want.
   - `TZ` — defaults to `Europe/Madrid`.
   - `COOLDOWN_SECONDS` — defaults to `30`.
6. **Deploy.** Railway picks up `apps/los_piratas_bot/railway.toml`; build = Dockerfile; healthcheck = `/health`.

## Local development

```
pnpm install
pnpm -F los_piratas_bot dev
```

`pnpm -F los_piratas_bot dev` uses `tsx watch`. Set the env vars in `.env` at the repo root for local runs.

## Tests

```
pnpm -F los_piratas_bot test
```

Covers day-of-week detection (with TZ boundaries), language detection (Spanish/English/short/unknown), the cooldown gate, and the prompt builder.
