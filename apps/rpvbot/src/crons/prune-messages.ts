import type { Config } from "../config.js";
import type { Services } from "../services.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes rows from `rpv_messages` older than `MESSAGE_RETENTION_DAYS`.
 * Sheets has no bulk delete-by-predicate; we issue one removeByKey per
 * stale row. Acceptable at this scale (small group × 30 days).
 */
export async function runPrune(
  services: Services,
  config: Config,
): Promise<void> {
  const cutoff = new Date(
    Date.now() - config.messageRetentionDays * MS_PER_DAY,
  ).toISOString();
  const all = await services.messages.listAll();
  const stale = all.filter((m) => m.sent_at < cutoff);
  if (stale.length === 0) {
    console.log("rpvbot: prune — nothing to delete");
    return;
  }
  console.log(
    `rpvbot: prune — deleting ${String(stale.length)} messages older than ${cutoff}`,
  );
  // Delete from the oldest first; sheet row indices shift up as we go,
  // and removeByKey re-queries by key so ordering is moot for correctness,
  // but stable iteration helps log readability.
  for (const m of stale) {
    try {
      await services.messages.removeByKey(m.message_id);
    } catch (err) {
      console.error(
        `rpvbot: prune failed for message_id ${String(m.message_id)}:`,
        err,
      );
    }
  }
}
