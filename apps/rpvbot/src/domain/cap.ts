export const RPV_MAX_N = 500;
export const MESSAGE_RETENTION_DAYS = 30;
export const RPV_GROUP_COOLDOWN_SECONDS = 60;
export const RPV_USER_COOLDOWN_SECONDS = 300;
// Max length of the free-text `notes` field on a soul card — the looser
// running memory the daily cron rewrites each run. A fixed domain
// constant (not env-tunable) because it's a SoulCardSchema bound,
// enforced at validation time before config exists.
export const NOTES_MAX_CHARS = 1200;

// A soul is stored as a JSON character card (stats + title + essence +
// traits + quirks + skills + catchphrase + notes). Worst case, every
// field at its zod max: title 80 + essence 400 + traits 5×120 + quirks
// 4×160 + skills 5×140 + catchphrase 200 + notes 1200 ≈ 3820 chars of
// content, plus JSON keys/quotes/punctuation ≈ 140 → ~3960 raw, ~4100
// post newline-encoding. 4500 leaves real headroom so even a worst-case
// card persists intact rather than getting truncated and regenerated.
export const SOULS_MAX_CHARS = 4500;
export const QUESTION_MAX_CHARS = 400;
export const QUESTION_CONTEXT_MESSAGES = 300;
