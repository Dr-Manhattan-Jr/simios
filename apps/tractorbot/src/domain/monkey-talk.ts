const PHRASES = [
  "🐒 ¡Ooh ooh ah ah! Arrancando el tractor…",
  "🍌 Un momento, el mono está calentando motores…",
  "🚜 Brrrrum brrrrum… acelerando neuronas…",
  "🐵 Plátano cargado, generando imagen…",
  "🌾 El mono ya está en el campo, sed pacientes…",
  "🛞 Pisando el embrague de la creatividad…",
  "🔧 Apretando tuercas con los pies, esto va a salir bien…",
  "💭 Pensando como un mono que conduce un tractor…",
  "🐒 Iiiik iiiik! ¡Aquí viene la obra maestra!",
  "☁️ Convocando al espíritu del mono granjero…",
  "🎨 Mezclando pintura con la cola del mono…",
  "🪖 Misión recibida, mono al volante…",
  "🪴 Sembrando píxeles, recogeremos imagen…",
  "🥁 Redoble de tambores… el mono está enfocado…",
  "🍌 Plátano + diesel = magia, espera…",
  "🐒 Aupa! Que viene el mono campesino…",
  "🏎️ El tractor del mono se ha puesto modo turbo…",
  "🤲 Las manos del mono ya están en el volante…",
];

export function pickMonkeyPhrase(rng: () => number = Math.random): string {
  const value = PHRASES[Math.floor(rng() * PHRASES.length)];
  if (value === undefined) {
    throw new Error("pickMonkeyPhrase: empty pool");
  }
  return value;
}
