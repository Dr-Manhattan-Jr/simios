/**
 * Group-wide cooldown gate. The bot fires at most once every `windowMs`
 * milliseconds, regardless of who triggered it.
 */
export interface Cooldown {
  tryFire(now: number): boolean;
}

export function createCooldown(windowMs: number): Cooldown {
  let lastFiredAt = Number.NEGATIVE_INFINITY;
  return {
    tryFire(now) {
      if (now - lastFiredAt < windowMs) return false;
      lastFiredAt = now;
      return true;
    },
  };
}

/**
 * Per-user cooldown gate. Each user_id has its own window. Memory grows
 * linearly with the number of distinct users who have ever fired — fine
 * for a small chat (handful of users), would need eviction if scaled up.
 */
export interface UserCooldown {
  tryFire(userId: number, now: number): boolean;
}

export function createUserCooldown(windowMs: number): UserCooldown {
  const lastByUser = new Map<number, number>();
  return {
    tryFire(userId, now) {
      const last = lastByUser.get(userId) ?? Number.NEGATIVE_INFINITY;
      if (now - last < windowMs) return false;
      lastByUser.set(userId, now);
      return true;
    },
  };
}
