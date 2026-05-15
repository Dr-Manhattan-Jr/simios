/**
 * Group-wide cooldown gate. The bot fires at most once every `windowMs`
 * milliseconds, regardless of who triggered it. Multiple members can't
 * burst the bot — one fire suppresses the whole group until the window
 * passes.
 */
export interface Cooldown {
  tryFire(now: number): boolean;
}

export function createCooldown(windowMs: number): Cooldown {
  // Number.NEGATIVE_INFINITY so the first call always passes regardless
  // of the absolute timestamp the caller chooses (epoch millis, ticks…).
  let lastFiredAt = Number.NEGATIVE_INFINITY;
  return {
    tryFire(now) {
      if (now - lastFiredAt < windowMs) return false;
      lastFiredAt = now;
      return true;
    },
  };
}
