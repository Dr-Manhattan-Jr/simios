import type { Config } from "../config.js";
import { summaryLanguage } from "../domain/day.js";
import { encodeNewlines, type MessageRecord } from "../domain/message.js";
import {
  capSoul,
  clampSoulCard,
  essenceOpener,
  groupMessagesByUser,
  parseSoulCard,
  serialiseSoulCard,
  skillThemeWords,
  SoulCardSchema,
  type SoulCard,
  type SoulRecord,
} from "../domain/soul.js";
import { renderTranscript } from "../domain/transcript.js";
import { previousCalendarDayBounds } from "../domain/window.js";
import type { GeminiTextClient } from "../gemini/text.js";
import {
  buildSoulPrompt,
  type SoulAvoidList,
  SOUL_CARD_RESPONSE_SCHEMA,
  systemPromptForSoul,
} from "../prompt/capitan-rpv.js";
import type { Services } from "../services.js";

function memberLabelFrom(m: MessageRecord): string {
  if (m.username !== undefined && m.username.length > 0) {
    return `@${m.username} (${m.first_name})`;
  }
  return m.first_name;
}

export async function runDailySouls(
  services: Services,
  gemini: GeminiTextClient,
  config: Config,
): Promise<void> {
  const language = summaryLanguage(new Date(), config.timeZone);
  const window = previousCalendarDayBounds(new Date(), config.timeZone);

  const [allMessages, allSouls] = await Promise.all([
    services.messages.listAll(),
    services.souls.listAll(),
  ]);
  const soulsById = new Map<number, SoulRecord>(
    allSouls.map((s) => [s.user_id, s]),
  );

  const byUser = groupMessagesByUser(allMessages, window);
  if (byUser.size === 0) {
    console.log("rpvbot: souls — no messages yesterday, nothing to update");
    return;
  }

  console.log(
    `rpvbot: souls — updating ${String(byUser.size)} member(s) for ${window.label}`,
  );

  let updated = 0;
  let failed = 0;

  // De-dup accumulator: titles / essence-openers / skill-theme words
  // already produced THIS run. Each member's prompt is told to avoid
  // them — the model generates one member at a time and otherwise can't
  // see it's repeating itself. Without this, cards converge on a few
  // moulds ("El Inquisidor de X", "Un alma pragmática…", "Nigromancia
  // de…"); a prompt that just says "be varied" doesn't fix that.
  const usedTitles: string[] = [];
  const usedOpeners: string[] = [];
  const usedSkillThemes = new Set<string>();

  // Sequential rather than parallel: keeps Gemini quota predictable and
  // souls aren't time-critical. Members who didn't speak yesterday are
  // skipped — their souls stay frozen at whatever they were last set to,
  // until they speak again.
  for (const [userId, userMessages] of byUser) {
    const first = userMessages[0];
    if (first === undefined) continue;
    const existing = soulsById.get(userId);
    const memberLabel = memberLabelFrom(first);
    const userTranscript = renderTranscript(userMessages, config.timeZone);
    // Previous card as JSON — parseSoulCard returns null for legacy
    // free-text souls, which we treat as "no card yet" (regenerated).
    const existingCard =
      existing !== undefined ? parseSoulCard(existing.soul_text) : null;
    const currentCardJson =
      existingCard !== null ? serialiseSoulCard(existingCard) : "";

    const avoid: SoulAvoidList = {
      titles: usedTitles,
      essenceOpeners: usedOpeners,
      skillThemes: [...usedSkillThemes],
    };
    const card = await synthesiseCard(gemini, {
      system: systemPromptForSoul(language),
      basePrompt: buildSoulPrompt({
        memberLabel,
        currentCardJson,
        transcript: userTranscript,
        language,
        avoid,
      }),
      memberLabel,
    });
    if (card === null) {
      // synthesiseCard already logged why; skip the member, retry next run.
      failed += 1;
      continue;
    }
    // Feed this card into the accumulator so later members avoid it.
    usedTitles.push(card.title);
    usedOpeners.push(essenceOpener(card.essence));
    for (const w of skillThemeWords(card.skills)) usedSkillThemes.add(w);
    // Store the card as a JSON string. Hard-cap the serialised length
    // (sliced on code points) as a defence — a card should be well under
    // the cap, but a truncated JSON just fails parseSoulCard next read
    // and the member regenerates, so this never corrupts anything fatally.
    const capped = capSoul(serialiseSoulCard(card), config.soulsMaxChars);
    const stored = encodeNewlines(capped);

    const baseRecord = {
      user_id: userId,
      first_name: first.first_name,
      soul_text: stored,
      soul_chars: stored.length,
      updated_at: new Date().toISOString(),
      runs: (existing?.runs ?? 0) + 1,
    };
    const record: SoulRecord =
      first.username !== undefined && first.username.length > 0
        ? { ...baseRecord, username: first.username }
        : baseRecord;
    try {
      await services.souls.upsert(record);
      updated += 1;
    } catch (err) {
      console.error(`rpvbot: soul upsert failed for ${memberLabel}:`, err);
      failed += 1;
    }
  }

  console.log(
    `rpvbot: souls — done for ${window.label}: ${String(updated)} updated, ${String(failed)} failed`,
  );
}

/**
 * One generate+validate attempt: ok with the card, `gemini-error`
 * (request failed — unrecoverable), or `invalid` (request succeeded but
 * the output failed validation even after clamping — retryable).
 */
type AttemptResult =
  | { readonly outcome: "ok"; readonly card: SoulCard }
  | { readonly outcome: "gemini-error" }
  | { readonly outcome: "invalid"; readonly error: string };

/**
 * Generate one member's soul card from Gemini, with a clamp-then-retry
 * pipeline:
 *  1. Generate. clampSoulCard trims any over-cap field, then safeParse.
 *  2. If it still fails (a structural problem clamping can't fix), retry
 *     ONCE with the zod error fed back so the model can self-correct.
 *  3. If the retry also fails, return null — the caller skips the member.
 */
async function synthesiseCard(
  gemini: GeminiTextClient,
  args: {
    readonly system: string;
    readonly basePrompt: string;
    readonly memberLabel: string;
  },
): Promise<SoulCard | null> {
  const attempt = async (user: string): Promise<AttemptResult> => {
    let raw: unknown;
    try {
      raw = await gemini.generateJson({
        system: args.system,
        user,
        temperature: 0.4,
        responseSchema: SOUL_CARD_RESPONSE_SCHEMA,
      });
    } catch (err) {
      console.error(
        `rpvbot: soul generation failed for ${args.memberLabel}:`,
        err,
      );
      return { outcome: "gemini-error" };
    }
    // clampSoulCard repairs over-cap strings/arrays; zod is still the
    // real boundary for everything clamping can't fix.
    const parsed = SoulCardSchema.safeParse(clampSoulCard(raw));
    return parsed.success
      ? { outcome: "ok", card: parsed.data }
      : { outcome: "invalid", error: parsed.error.message };
  };

  const first = await attempt(args.basePrompt);
  if (first.outcome === "ok") return first.card;
  if (first.outcome === "gemini-error") return null;

  // Validation failed on something clamping couldn't repair — retry once
  // with the zod error fed back so the model can correct itself.
  console.warn(
    `rpvbot: soul card invalid for ${args.memberLabel}, retrying: ${first.error}`,
  );
  const retryPrompt =
    `${args.basePrompt}\n\n` +
    `IMPORTANT — your previous attempt was rejected. Fix these problems ` +
    `and return a valid card: every stat must be an integer 1–10, all ` +
    `required fields must be present, and arrays must stay within their ` +
    `limits. Validation error: ${first.error}`;
  const second = await attempt(retryPrompt);
  if (second.outcome === "ok") return second.card;
  if (second.outcome === "invalid") {
    console.error(
      `rpvbot: soul card still invalid for ${args.memberLabel} after retry: ${second.error}`,
    );
  }
  return null;
}
