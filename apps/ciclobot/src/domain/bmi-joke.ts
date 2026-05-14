/**
 * "Broca-style" body shape joke for the /join reply. Not medical advice;
 * the whole point is the punchline, not the math.
 *
 * Reference weight = (height_cm - 100). Bands:
 *   - more than 2kg below reference → "flaco"
 *   - more than 10kg above reference → "fat ass"
 *   - otherwise → "looking solid"
 */

const FLACO_LINES = [
  "Flaco 🍃 — ¿comes pan o lo miras? Tiempo de barra olímpica.",
  "Flaco modo on 💨 — el viento te lleva. Súbele al deadlift.",
  "Flaco 🥖 — necesitas más arroz y menos cardio improvisado.",
];

const FAT_ASS_LINES = [
  "Fat ass detected 🍔 — pero tranquilo, eso es base para mover peso. Vamos al squat.",
  "Carga pesada 💪 — más músculo del que parece, ¿no? Demuéstralo en el log.",
  "Estructural 🏗️ — fuerza bruta a la espera. Que se note en el bench.",
];

const HEALTHY_LINES = [
  "Buen punto de partida 💯 — a moverla.",
  "Looking solid 🔥 — ahora a meterle volumen al squat.",
  "Tipo gym 🏋️ — ya solo queda demostrarlo cada semana.",
];

export type ShapeVerdict = "flaco" | "fat-ass" | "healthy";

export interface JoinJoke {
  verdict: ShapeVerdict;
  line: string;
}

function pick<T>(arr: ReadonlyArray<T>, seed: number): T {
  const i = Math.abs(seed) % arr.length;
  const item = arr[i];
  if (item === undefined) throw new Error("empty joke array");
  return item;
}

export function shapeJoke(
  heightCm: number,
  weightKg: number,
  seed: number = Date.now(),
): JoinJoke {
  const reference = heightCm - 100;
  if (weightKg < reference - 2) {
    return { verdict: "flaco", line: pick(FLACO_LINES, seed) };
  }
  if (weightKg > reference + 10) {
    return { verdict: "fat-ass", line: pick(FAT_ASS_LINES, seed) };
  }
  return { verdict: "healthy", line: pick(HEALTHY_LINES, seed) };
}
