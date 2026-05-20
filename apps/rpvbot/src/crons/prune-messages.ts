import type { Config } from "../config.js";
import type { Services } from "../services.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes rows from `rpv_messages` and `rpv_images` older than
 * `MESSAGE_RETENTION_DAYS`. Sheets has no bulk delete-by-predicate; we
 * issue one removeByKey per stale row. Acceptable at this scale (small
 * group × 30 days).
 */
export async function runPrune(
  services: Services,
  config: Config,
): Promise<void> {
  const cutoff = new Date(
    Date.now() - config.messageRetentionDays * MS_PER_DAY,
  ).toISOString();

  const [allMessages, allImages] = await Promise.all([
    services.messages.listAll(),
    services.images.listAll(),
  ]);
  const staleMessages = allMessages.filter((m) => m.sent_at < cutoff);
  const staleImages = allImages.filter((i) => i.sent_at < cutoff);

  if (staleMessages.length === 0 && staleImages.length === 0) {
    console.log("rpvbot: prune — nothing to delete");
    return;
  }
  console.log(
    `rpvbot: prune — deleting ${String(staleMessages.length)} messages, ` +
      `${String(staleImages.length)} images older than ${cutoff}`,
  );
  for (const m of staleMessages) {
    try {
      await services.messages.removeByKey(m.message_id);
    } catch (err) {
      console.error(
        `rpvbot: prune failed for message_id ${String(m.message_id)}:`,
        err,
      );
    }
  }
  for (const i of staleImages) {
    try {
      await services.images.removeByKey(i.message_id);
    } catch (err) {
      console.error(
        `rpvbot: prune failed for image ${String(i.message_id)}:`,
        err,
      );
    }
  }
}
