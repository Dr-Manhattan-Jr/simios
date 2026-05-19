# rpvbot

Telegram bot — **Capitán RPV**, the chronicler of the group. Two features:

- **Daily Resume.** Every morning at 09:00 Europe/Madrid, the bot posts a short narrative summary of yesterday's chat (00:00–23:59 of the previous calendar day). Quotes 2–3 of the most active participants, storytelling tone, no invented facts.
- **`/rpv [N]`.** On demand, anyone in the group can summarise the last `N` messages (default 100, max 500).

**Language rule:** the body is written in **Spanish on Mon–Thu and Sat–Sun**, and in **English on Fridays**, aligned with `los_piratas_bot`'s "English Friday" theme. The fixed prefix lines (`📜 Daily Resume — …`, `🧭 Unread Resume — last N messages`) stay English always — they're the machine-readable contract for future "retrieve all resumes from last year" features.

**Always-on, no opt-in.** The bot persists every text message in the configured `CHAT_ID` to a `rpv_messages` tab on the shared spreadsheet. Generated summaries are appended to `rpv_summaries`. Slash commands are not archived; the bot's own messages aren't either (Telegram doesn't deliver them back).

## How it decides

1. Listen on `bot.on("message:text")` filtered by `onlyChat(CHAT_ID)`.
2. Skip slash commands and anonymous channel posts.
3. Upsert the message into `rpv_messages` (key = Telegram `message_id`, naturally idempotent).
4. Daily cron at 09:00: pull yesterday's window from `rpv_messages`, render a transcript, ask Gemini 2.5 Flash for a Capitán RPV–voiced summary, post it with the `📜` prefix, record the result in `rpv_summaries`.
5. `/rpv N` command: pull the last N messages, same prompt path, post with the `🧭` prefix.
6. Prune cron at 03:00: delete messages older than `MESSAGE_RETENTION_DAYS` (default 30). Summaries are kept forever.

## Sheets

Two tabs on the same spreadsheet as ciclobot and los_piratas_bot.

### `rpv_messages` (30-day rolling)

| message_id | sent_at | user_id | username | first_name | text | reply_to_id |
|------------|---------|---------|----------|------------|------|-------------|

- `message_id` is the table key. Sheets `upsert` makes re-delivery a no-op.
- `text` has newlines encoded as `\n` (literal backslash-n) so each message stays on one Sheets row.
- `reply_to_id` is `0` when the message is not a reply.

### `rpv_summaries` (kept forever)

| id | kind | generated_at | window_start | window_end | message_count | requested_by | text |
|----|------|--------------|--------------|------------|---------------|--------------|------|

- `id` is a random UUID (table key).
- `kind` is `daily` or `unread`.
- `requested_by` is `0` for `daily`, the requesting `user_id` for `unread`.

## Manual setup

1. **Create the Telegram bot.** BotFather → `/newbot` → name `Capitán RPV`, username `rpv_bot` (or whatever is available). Copy the HTTP API token.
2. **Add the bot to your group.** No admin rights needed.
3. **Get the group chat ID.** Run rpvbot once with an obviously wrong `CHAT_ID` and read the `onlyChat: dropping update from chat -100…` log line — that's your real ID.
4. **Get a Gemini API key.** Reuse the one used by `los_piratas_bot`. (Same Google project, no extra setup.)
5. **Set Railway env vars** for the `rpvbot` service:
   - `BOT_TOKEN` — from BotFather.
   - `CHAT_ID` — the negative chat ID (supergroups need the `-100` prefix).
   - `GEMINI_API_KEY` — same as `los_piratas_bot`.
   - `SHEET_ID` — same spreadsheet as `ciclobot` and `los_piratas_bot` (rpvbot creates two new tabs there).
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — same service account JSON as the other bots.
   - `GEMINI_MODEL` — defaults to `gemini-2.5-flash`.
   - `TZ` — defaults to `Europe/Madrid`.
   - `DAILY_RESUME_CRON` — defaults to `0 9 * * *` (09:00 daily, timezone-aware).
   - `PRUNE_CRON` — defaults to `0 3 * * *` (03:00 daily).
   - `RPV_DEFAULT_N` — defaults to `100`.
   - `RPV_MAX_N` — defaults to `500`.
   - `MESSAGE_RETENTION_DAYS` — defaults to `30`.
6. **Deploy.** Railway picks up `apps/rpvbot/railway.toml`; build = Dockerfile; healthcheck = `/health`.

## Local development

```
pnpm install
pnpm -F rpvbot dev
```

Set the env vars in `.env` at the repo root for local runs. Lower the cron/retention values to exercise the daily flow without waiting 24h.

## Tests

```
pnpm -F rpvbot test
```

Covers `/rpv` argument parsing, day-of-week language switching, previous-calendar-day window calculation (with DST edge cases), and transcript rendering.
