/**
 * Per-user cooldown gate. Each user has their own clock — one user's
 * trigger doesn't suppress others. Within a single user's window the
 * gate stays closed.
 */
export interface Cooldown {
  tryFire(userId: number, now: number): boolean;
}

export function createCooldown(windowMs: number): Cooldown {
  const lastFiredByUser = new Map<number, number>();
  return {
    tryFire(userId, now) {
      const last = lastFiredByUser.get(userId);
      if (last !== undefined && now - last < windowMs) return false;
      lastFiredByUser.set(userId, now);
      return true;
    },
  };
}
