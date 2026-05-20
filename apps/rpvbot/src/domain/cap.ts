export const RPV_MAX_N = 500;
export const MESSAGE_RETENTION_DAYS = 30;
export const RPV_GROUP_COOLDOWN_SECONDS = 60;
export const RPV_USER_COOLDOWN_SECONDS = 300;
// A soul is stored as a JSON character card (stats + title + essence +
// traits + quirks + skills + catchphrase). A maximally verbose card —
// every field at its zod max — serialises to roughly 2.9k chars; 3200
// gives real headroom so even a worst-case card persists intact rather
// than getting truncated and regenerated next run.
export const SOULS_MAX_CHARS = 3200;
export const QUESTION_MAX_CHARS = 400;
export const QUESTION_CONTEXT_MESSAGES = 300;
