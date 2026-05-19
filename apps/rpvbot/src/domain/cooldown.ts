/**
 * Result of attempting to fire a cooldown gate. Always returns
 * `remainingMs` for telemetry — 0 on success (i.e. fired), positive on
 * block. Lets the caller render "try again in 42s" replies without
 * having to track timestamps externally.
 */
export type CooldownResult =
  | { readonly fired: true; readonly remainingMs: 0 }
  | { readonly fired: false; readonly remainingMs: number };

/**
 * Group-wide cooldown gate. The bot fires at most once every `windowMs`
 * milliseconds, regardless of who triggered it.
 */
export interface Cooldown {
  tryFire(now: number): CooldownResult;
}

export function createCooldown(windowMs: number): Cooldown {
  let lastFiredAt = Number.NEGATIVE_INFINITY;
  return {
    tryFire(now) {
      const elapsed = now - lastFiredAt;
      if (elapsed < windowMs) {
        return { fired: false, remainingMs: windowMs - elapsed };
      }
      lastFiredAt = now;
      return { fired: true, remainingMs: 0 };
    },
  };
}

/**
 * Per-user cooldown gate. Each user_id has its own window. Memory grows
 * linearly with the number of distinct users who have ever fired — fine
 * for a small chat (handful of users), would need eviction if scaled up.
 */
export interface UserCooldown {
  tryFire(userId: number, now: number): CooldownResult;
}

export function createUserCooldown(windowMs: number): UserCooldown {
  const lastByUser = new Map<number, number>();
  return {
    tryFire(userId, now) {
      const last = lastByUser.get(userId) ?? Number.NEGATIVE_INFINITY;
      const elapsed = now - last;
      if (elapsed < windowMs) {
        return { fired: false, remainingMs: windowMs - elapsed };
      }
      lastByUser.set(userId, now);
      return { fired: true, remainingMs: 0 };
    },
  };
}
