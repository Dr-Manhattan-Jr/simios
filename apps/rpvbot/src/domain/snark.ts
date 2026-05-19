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
