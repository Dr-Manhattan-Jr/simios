/**
 * Bounded set of recently-seen message IDs. Used to dedupe handler runs
 * caused by deploy overlaps: when an old container is still draining
 * and a new one starts polling, Telegram can deliver the same update
 * to both. Each container individually decides to reply, you get a
 * double message.
 *
 * Tracks the last `capacity` message IDs and drops the oldest when
 * full. Single-process, in-memory — fine because both containers in an
 * overlap window each have their own copy; the dedup catches the case
 * within a single container that grammY (rarely) re-delivers an update.
 *
 * For full deploy-overlap protection we additionally rely on a short
 * draining window (set in railway.toml) so two containers don't poll
 * concurrently.
 */
export interface Dedup {
  /** True iff this id has NOT been seen in the recent window. Records the id. */
  acceptOnce(messageId: number): boolean;
}

export function createDedup(capacity: number): Dedup {
  const seen = new Set<number>();
  const order: number[] = [];
  return {
    acceptOnce(messageId) {
      if (seen.has(messageId)) return false;
      seen.add(messageId);
      order.push(messageId);
      while (order.length > capacity) {
        const dropped = order.shift();
        if (dropped !== undefined) seen.delete(dropped);
      }
      return true;
    },
  };
}
