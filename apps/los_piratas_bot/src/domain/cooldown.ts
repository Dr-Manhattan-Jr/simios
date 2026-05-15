/**
 * Group-wide cooldown gate. The bot fires at most once every `windowMs`
 * milliseconds, regardless of who triggered it. Calling `tryFire(now)`
 * returns true if the gate is open AND records the firing; subsequent
 * calls within the window return false.
 */
export interface Cooldown {
  tryFire(now: number): boolean;
}

export function createCooldown(windowMs: number): Cooldown {
  // Use Number.NEGATIVE_INFINITY so the first call always passes regardless
  // of the absolute timestamp the caller chooses (epoch millis, ticks, …).
  let lastFiredAt = Number.NEGATIVE_INFINITY;
  return {
    tryFire(now) {
      if (now - lastFiredAt < windowMs) return false;
      lastFiredAt = now;
      return true;
    },
  };
}
