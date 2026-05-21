# rpvbot

Telegram bot — **Capitán RPV**, the chronicler of the group. Four features:

- **Daily Resume.** Every morning at 09:00 Europe/Madrid, the bot posts a short narrative summary of yesterday's chat (00:00–23:59 of the previous calendar day). Quotes 2–3 of the most active participants, storytelling tone, no invented facts.
- **`/rpv <N | question>`.** On demand, anyone in the group can either:
  - Pass a **positive integer** (max 500) to get a Capitán RPV summary of the last N messages, OR
  - Pass a **free-text question** (any other input) to get an answer grounded in the persisted chat history. The question is treated as untrusted input: the system prompt refuses prompt-extraction, infra-disclosure, and instruction-injection attempts, and the bot never invents facts beyond the transcript. Member **souls** (see below) are also injected as background context, so the bot understands who people are — but the transcript stays the source of hard facts; souls only colour the answer, never override what was actually said.
  Rate-limited: at most one fire per 60 s group-wide, and the same user can't fire more than once per 5 min. Abusers get a snarky one-liner. The bot reply-quotes the triggering `/rpv` so the answer threads under it in Telegram.
- **Daily souls cron.** Every day at 02:00 Europe/Madrid, the bot reads yesterday's messages, groups them by member, and incrementally updates a per-member "soul" — a **dark-fantasy RPG character card**. The card has six fixed numeric stat axes (verbosity, humor, chaos, wisdom, horniness, menace, each 1–10, scored relative to a normal group member) plus free-form imaginative fields: a fantasy class `title`, an `essence`, `traits`, `quirks`, funny RPG-style `skills`, an optional `catchphrase`, and a free-text `notes` field — a looser, capped running memory (in-jokes, evolving context, recurring dynamics) that the rigid card slots can't hold. Update is `previous_card + new_messages → new_card` via Gemini structured-JSON synthesis, stored as JSON in the `rpv_souls` tab; every field, including `notes`, is re-synthesised (evolved, not reset) each run. Souls are not exposed via a command, but the whole card — stats, fields, and `notes` — is injected as background context into `/rpv` question answers (see above).
- **Image OCR cron.** When someone shares a **photo** or a **static sticker**, the bot captures it instantly (a `pending` row in the `rpv_images` tab) and an hourly cron downloads it, runs it through Gemini 2.5 Flash for **OCR + a short description**, and rewrites the image's `rpv_messages` text to a `[photo: …]` / `[sticker: …]` token. The bot's whole context (resume, `/rpv`, souls) then sees what was shared — a screenshot, a meme, a photo — with no other code changes. Animated stickers (`.tgs`), video stickers (`.webm`) and GIFs (Telegram delivers them as MP4) can't be read as still images, so they keep their emoji+set token only.

**Language rule:** the summary/answer body is written in **Spanish on Mon–Thu and Sat–Sun**, and in **English on Fridays**, aligned with `los_piratas_bot`'s "English Friday" theme. The fixed prefix lines (`📜 Daily Resume — …`, `🧭 Unread Resume — last N messages`, `🧭 Question — …`) stay English always — they're the machine-readable contract for future "retrieve all resumes from last year" features.

**Always-on, no opt-in.** The bot persists every text message, sticker, and photo in the configured `CHAT_ID` to a `rpv_messages` tab on the shared spreadsheet. Stickers/photos start as a short text token (`[sticker 😭 from PepeReactions]`, `[photo]`); shared photos and static stickers are also queued in `rpv_images` for the OCR cron to enrich. Generated summaries / answers are appended to `rpv_summaries`. Souls are upserted in `rpv_souls`. Slash commands are not archived; the bot's own messages aren't either (Telegram doesn't deliver them back).

## How it decides

1. Listen on `bot.on("message:text")`, `bot.on("message:sticker")`, and `bot.on("message:photo")` filtered by `onlyChat(CHAT_ID)`.
2. Skip slash commands (text only) and anonymous channel posts.
3. Upsert into `rpv_messages` (key = Telegram `message_id`, naturally idempotent). Photos + static stickers also get a `pending` row in `rpv_images`.
4. Daily 09:00 cron: pull yesterday's window, render a transcript, ask Gemini for a Capitán RPV–voiced summary, post it with the `📜` prefix, record in `rpv_summaries`.
5. Daily 02:00 cron: pull yesterday's window, group by user, for each user fold their messages into their soul (`rpv_souls`).
6. Hourly cron: take up to `OCR_MAX_PER_RUN` `pending` images, download + describe each via Gemini vision, rewrite the linked `rpv_messages` text.
7. Daily 03:00 cron: delete `rpv_messages` and `rpv_images` rows older than `MESSAGE_RETENTION_DAYS` (default 30). Summaries and souls are kept forever.
8. `/rpv` command: parse arg as integer (count mode) or sanitised free text (question mode). Count mode → last-N summary. Question mode → grounded answer from the last `QUESTION_CONTEXT_MESSAGES` (default 300).

## Sheets

Four tabs on the same spreadsheet as `ciclobot` and `los_piratas_bot`.

### `rpv_messages` (30-day rolling)

| message_id | sent_at | user_id | username | first_name | text | reply_to_id |
|------------|---------|---------|----------|------------|------|-------------|

- `message_id` is the table key. Sheets `upsert` makes re-delivery a no-op.
- `text` has newlines encoded as `\n` (literal backslash-n) so each message stays on one Sheets row.
- Stickers store text like `[sticker 😭 from PepeReactions]`. Photos start as `[photo]` and are rewritten to `[photo: <description> | text in image: <ocr>]` once the OCR cron runs.
- `reply_to_id` is `0` when the message is not a reply.

### `rpv_summaries` (kept forever)

| id | kind | generated_at | window_start | window_end | message_count | requested_by | text |
|----|------|--------------|--------------|------------|---------------|--------------|------|

- `id` is a random UUID (table key).
- `kind` is `daily`, `unread`, or `question`.
- `requested_by` is `0` for `daily`; the requesting `user_id` for `unread`/`question`.
- For `question` rows, `text` is stored as `Q: <question>\nA: <answer>` so the row is self-contained.

### `rpv_souls` (one row per member, upserted in place)

| user_id | username | first_name | soul_text | soul_chars | updated_at | runs |
|---------|----------|------------|-----------|------------|------------|------|

- `user_id` is the table key. Updated daily by the 02:00 souls cron; members who didn't speak yesterday are skipped.
- `soul_text` is the RPG character card as a newline-encoded JSON string (`{ title, essence, traits[], quirks[], skills[], catchphrase?, notes, stats{...} }`). `notes` is a free-text running memory (capped ~1200 chars). Legacy souls from before a field was added are simply regenerated on the next cron run.
- `soul_chars` is the post-encoding length, hard-capped at `SOULS_MAX_CHARS` (default 4500).
- `runs` is a monotonic counter — how many times this soul has been updated.

### `rpv_images` (30-day rolling)

| message_id | kind | file_id | mime_type | sent_at | user_id | username | first_name | caption | sticker_meta | status | attempts | description | ocr_text | processed_at |
|------------|------|---------|-----------|---------|---------|----------|------------|---------|--------------|--------|----------|-------------|----------|--------------|

- `message_id` is the table key — the message that carried the image.
- `kind` is `photo` or `sticker` (static `.webp` stickers only).
- `status` is `pending` → `done` (OCR'd) / `failed` (transient, retried up to 3×) / `skipped` (file gone or too big — never retried).
- `description` + `ocr_text` are filled by the hourly OCR cron and written back into the linked `rpv_messages` row.
- Pruned on the same 30-day horizon as `rpv_messages`.

## Hostile-input handling (/rpv questions)

User-supplied free text flowing into an LLM prompt is treated as untrusted. Two layers:

1. **Sanitisation at the boundary** (`src/domain/question.ts`): length cap, ASCII + Unicode control-character strip (zero-width spaces, RTL/LTR overrides, BOM, etc.), whitespace collapse. Rejects empty-after-trim.
2. **System-prompt defence** (`src/prompt/capitan-rpv.ts`): explicit rules forbidding (a) revealing/paraphrasing the system prompt, (b) revealing infrastructure (model, env vars, sheet IDs, Telegram chat ID, etc.), (c) following user-text-as-instruction (jailbreaks, role-plays, "ignore previous instructions", etc.), (d) inventing facts not in the transcript, (e) disclosing private member info beyond what they wrote in chat. The system prompt is the actual security boundary — sanitisation is hygiene.

## Manual setup

1. **Create the Telegram bot.** BotFather → `/newbot` → name `Capitán RPV`, username `rpv_bot` (or whatever is available). Copy the HTTP API token.
2. **Add the bot to your group.** No admin rights needed.
3. **Get the group chat ID.** Run rpvbot once with an obviously wrong `CHAT_ID` and read the `onlyChat: dropping update from chat -100…` log line — that's your real ID.
4. **Get a Gemini API key.** Reuse the one used by `los_piratas_bot`. (Same Google project, no extra setup.)
5. **Set Railway env vars** for the `rpvbot` service:
   - `BOT_TOKEN` — from BotFather.
   - `CHAT_ID` — the negative chat ID (supergroups need the `-100` prefix).
   - `GEMINI_API_KEY` — same as `los_piratas_bot`.
   - `SHEET_ID` — same spreadsheet as `ciclobot` and `los_piratas_bot` (rpvbot creates four new tabs there).
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — same service account JSON as the other bots.
   - `GEMINI_MODEL` — defaults to `gemini-2.5-flash`.
   - `TZ` — defaults to `Europe/Madrid`.
   - `DAILY_RESUME_CRON` — defaults to `0 9 * * *`.
   - `SOULS_CRON` — defaults to `0 2 * * *`.
   - `OCR_CRON` — defaults to `0 * * * *` (hourly). `"off"` disables the image OCR cron.
   - `PRUNE_CRON` — defaults to `0 3 * * *`.
   - `RPV_MAX_N` — defaults to `500`.
   - `MESSAGE_RETENTION_DAYS` — defaults to `30`.
   - `RPV_GROUP_COOLDOWN_SECONDS` — defaults to `60`.
   - `RPV_USER_COOLDOWN_SECONDS` — defaults to `300` (5 min).
   - `SOULS_MAX_CHARS` — defaults to `4500`. Hard cap on `soul_text` (the JSON card) length (post-encoding).
   - `QUESTION_MAX_CHARS` — defaults to `400`. Cap applied to sanitised question text.
   - `QUESTION_CONTEXT_MESSAGES` — defaults to `300`. How many recent messages to feed the question prompt.
   - `OCR_MAX_PER_RUN` — defaults to `20`. Max images the OCR cron processes per hourly run.
   - `OCR_MAX_IMAGE_BYTES` — defaults to `4194304` (4 MB). Larger photo resolutions are skipped.
6. **Deploy.** Railway picks up `apps/rpvbot/railway.toml`; build = Dockerfile; healthcheck = `/health`.

## Local development

```
pnpm install
pnpm -F rpvbot dev
```

Set the env vars in `.env` at the repo root for local runs. Lower the cron values to exercise the daily flows without waiting 24h (e.g. `SOULS_CRON="*/3 * * * *"`).

## Tests

```
pnpm -F rpvbot test
```

Covers `/rpv` argument parsing (count vs question), question sanitisation (injection-shaped payloads), day-of-week language switching, previous-calendar-day window calculation (with DST edge cases), transcript rendering, sticker text formatting, souls per-user grouping, the hostile-input defence in the question system prompt, the image record schema, the `[photo: …]` / `[sticker: …]` token builder, and the OCR cron's pending-image selection.
