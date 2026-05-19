import type { SummaryLanguage } from "./day.js";

/**
 * Random snarky replies for when /rpv is rate-limited. Same language rule
 * as the summaries themselves (English on Fridays, Spanish otherwise).
 */
const SNARK_ES: readonly string[] = [
  "Calma, grumete. La bitácora no se escribe a tirones.",
  "Una a una, marinero. El capitán no es máquina de monedas.",
  "Bajad las anclas, que no es regata.",
  "Paciencia, que el ron también necesita reposar.",
  "Despacio. El mar se ríe de los que tienen prisa.",
  "Ya he soltado tinta, esperad a que seque.",
  "Otro /rpv y os mando a fregar la cubierta.",
  "El capitán está echando una siesta. Volved en un rato.",
];

const SNARK_EN: readonly string[] = [
  "Easy, sailor. The log isn't written in jerks.",
  "One at a time, deckhand. The captain is not a vending machine.",
  "Drop the anchor, this isn't a regatta.",
  "Patience. Even the rum needs to rest.",
  "Slow down. The sea laughs at those in a hurry.",
  "Ink's still wet. Let it dry.",
  "Another /rpv and you're scrubbing the deck.",
  "The captain is napping. Try again later.",
];

export function randomSnark(language: SummaryLanguage): string {
  const pool = language === "en" ? SNARK_EN : SNARK_ES;
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ?? pool[0] ?? "…";
}

/**
 * "MM:SS" suffix. Rounds remaining ms UP so the user is never told
 * "00:00" while the gate is still closed — a 0.5s remainder still
 * reads as "00:01".
 */
export function formatRemaining(remainingMs: number): string {
  const totalSec = Math.max(1, Math.ceil(remainingMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function snarkWithCooldown(
  language: SummaryLanguage,
  remainingMs: number,
): string {
  const base = randomSnark(language);
  // No exact remaining time (e.g. in-flight request) → no parenthetical.
  if (remainingMs <= 0) return base;
  return `${base} (${formatRemaining(remainingMs)})`;
}
