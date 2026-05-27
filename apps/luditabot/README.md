# luditabot

Telegram bot that listens to a group chat and, whenever someone says **ludita**, **luditas**, **luddite**, or **luddites**, replies with a freshly Gemini-generated image of a monkey opposing technology or modern advances.

## What it does

- Listens to every text message in one configured group.
- Trigger words default to `ludita,luditas,luddite,luddites`, case-insensitive and whole-word only.
- Each generation picks random parts: visual style, modern threat, setting, monkey quirk, action, mood, camera angle, and lighting.
- Text written alongside the trigger becomes visual inspiration for the prompt. A message like `ludita contra los patinetes electricos` steers the image toward that theme.
- Replies with the generated photo, captioned with the style and optional hint.
- Cooldown defaults to 60 seconds to keep spam contained.

## Telegram privacy setting

For luditabot to read ordinary group chatter, BotFather privacy must be **OFF**:

1. Message [@BotFather](https://t.me/BotFather) -> `/setprivacy` -> pick this bot -> **Disable**.
2. If the bot was already in the group, remove and re-add it so the change takes effect.

## Add it to a Telegram group

1. Create the bot with BotFather using `/newbot`, then copy the HTTP API token as `BOT_TOKEN`.
2. Disable privacy as described above.
3. Add the bot to the target group.
4. Get the group's numeric `CHAT_ID`. Two reliable options:
   - Send a group message, then open `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` and find `chat.id`.
   - Temporarily run the bot with a wrong `CHAT_ID`; the `onlyChat: dropping update from chat -100...` log line shows the real ID.
5. Set the env vars locally or in Railway.

## Env vars

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `BOT_TOKEN` | yes | - | BotFather token. |
| `GEMINI_API_KEY` | yes | - | AI Studio key. |
| `CHAT_ID` | yes | - | Negative numeric ID of the target group. |
| `TRIGGER_WORDS` | no | `ludita,luditas,luddite,luddites` | Comma-separated, case-insensitive, whole-word. |
| `COOLDOWN_SECONDS` | no | `60` | Minimum seconds between successful generations. |
| `GEMINI_MODEL` | no | `gemini-2.5-flash-image` | Override only if Google renames the image model. |

## Deploy

Add luditabot as a separate Railway service in the same project as the other bots. In the service settings:

1. Source -> the same GitHub repo.
2. Config-as-Code -> set the config file path to `/apps/luditabot/railway.toml`.
3. Variables -> set `BOT_TOKEN`, `GEMINI_API_KEY`, and `CHAT_ID`.

Railway deploys happen by pushing to GitHub. Do not run `railway up` for this repo.

## Local dev

```
pnpm install
pnpm -F luditabot dev
```

The bot fails fast if any required env var is missing.

## Pull request from a fork

1. Commit the change on a feature branch, for example `feat/ludita`.
2. Push the branch to your fork: `git push origin feat/ludita`.
3. Open GitHub and create a Pull Request from your fork branch into the original repository's default branch.
4. In the PR description, mention that this adds `luditabot`, a Telegram/Gemini image bot based on `tractorbot`, plus setup docs.

If you want to keep your fork synced before opening the PR, add the original repository as `upstream`, fetch it, and rebase your branch on `upstream/main`.

## Architecture notes

- Same strict-TS + zod conventions as the rest of the repo. No `as`, no `!`, no `any`.
- No persistence: luditabot has no Google Sheet and no domain state.
- The Gemini client is a thin REST wrapper. Response JSON is zod-parsed before reading inline image bytes.
