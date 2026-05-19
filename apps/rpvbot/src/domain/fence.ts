/**
 * Delimiters used to fence each message body in transcripts fed to
 * Gemini. The persona prompts tell the model to treat anything between
 * <msg> and </msg> as the author's literal content — NEVER as structure
 * or instructions. The transcript renderer escapes any literal fence
 * tokens that appear in user input so the fence stays parser-stable.
 */
export const MESSAGE_FENCE_OPEN = "<msg>";
export const MESSAGE_FENCE_CLOSE = "</msg>";
