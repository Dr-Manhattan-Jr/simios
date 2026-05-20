import type { Config } from "../config.js";
import { summaryLanguage } from "../domain/day.js";
import { encodeNewlines, type MessageRecord } from "../domain/message.js";
import {
  capSoul,
  groupMessagesByUser,
  parseSoulCard,
  serialiseSoulCard,
  SoulCardSchema,
  type SoulRecord,
} from "../domain/soul.js";
import { renderTranscript } from "../domain/transcript.js";
import { previousCalendarDayBounds } from "../domain/window.js";
import type { GeminiTextClient } from "../gemini/text.js";
import {
  buildSoulPrompt,
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

    let raw: unknown;
    try {
      raw = await gemini.generateJson({
        system: systemPromptForSoul(language),
        user: buildSoulPrompt({
          memberLabel,
          currentCardJson,
          transcript: userTranscript,
          language,
        }),
        temperature: 0.4,
        responseSchema: SOUL_CARD_RESPONSE_SCHEMA,
      });
    } catch (err) {
      console.error(
        `rpvbot: soul generation failed for ${memberLabel}:`,
        err,
      );
      failed += 1;
      continue;
    }
    // Zod is the real boundary — the Gemini responseSchema only improves
    // the odds of valid JSON; never trust it. On a bad card, skip the
    // member (don't write a broken row); they retry next run.
    const parsed = SoulCardSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `rpvbot: soul card invalid for ${memberLabel}: ${parsed.error.message}`,
      );
      failed += 1;
      continue;
    }
    // Store the card as a JSON string. Hard-cap the serialised length
    // (sliced on code points) as a defence — a card should be well under
    // the cap, but a truncated JSON just fails parseSoulCard next read
    // and the member regenerates, so this never corrupts anything fatally.
    const capped = capSoul(serialiseSoulCard(parsed.data), config.soulsMaxChars);
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
