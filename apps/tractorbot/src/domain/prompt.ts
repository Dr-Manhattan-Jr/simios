const STYLES = [
  "vintage 1970s film photograph",
  "Studio Ghibli watercolor",
  "Pixar 3D render",
  "oil painting in the style of a Dutch master",
  "black-and-white wood engraving",
  "Saturday morning cartoon",
  "low-poly PS1 graphics",
  "claymation still",
  "Renaissance fresco",
  "synthwave neon poster",
  "pencil sketch from a field naturalist's notebook",
  "Soviet propaganda poster",
  "Polaroid snapshot",
  "Wes Anderson symmetrical wide shot",
  "Hayao Miyazaki concept art",
  "Lego brick diorama",
  "cyberpunk anime cel",
  "watercolor children's book illustration",
  "stained-glass window panel",
  "comic book panel with halftone shading",
];

const TRACTORS = [
  "rusty red tractor",
  "shiny green John Deere",
  "tiny toy tractor",
  "enormous monster-truck tractor",
  "antique steam-powered tractor",
  "futuristic levitating tractor",
  "wooden hand-carved tractor",
  "neon-lit tractor with chrome exhausts",
  "muddy farm tractor pulling a plow",
  "tractor with comically oversized wheels",
];

const SETTINGS = [
  "in a golden wheat field at sunset",
  "on a muddy jungle trail",
  "rolling through a snowy Alpine pass",
  "in the middle of a busy city intersection",
  "on the surface of the Moon",
  "in an Italian vineyard at dawn",
  "down a cobblestone European village street",
  "across a Martian desert with two suns",
  "through a flooded rice paddy",
  "on a beach with crashing waves behind",
  "in a flower-filled mountain meadow",
  "deep in a misty redwood forest",
  "on top of a tall grassy hill",
  "in a thunderstorm with lightning behind",
  "through autumn leaves on a country lane",
];

const MONKEY_QUIRKS = [
  "wearing aviator sunglasses",
  "smoking a corncob pipe",
  "with a tiny straw cowboy hat",
  "drinking from a coconut",
  "wearing overalls and chewing on wheat",
  "sporting a beret and a tiny mustache",
  "with a baby monkey co-pilot",
  "wearing a racing helmet",
  "holding a baguette",
  "with a parrot on its shoulder",
  "wearing a tuxedo",
  "with sunglasses and a gold chain",
];

const MOODS = [
  "looking extremely smug",
  "with a determined expression",
  "laughing maniacally",
  "looking serene and zen-like",
  "with intense focus",
  "looking utterly bewildered",
  "with a heroic, triumphant pose",
];

function pickOne<T>(rng: () => number, arr: readonly T[]): T {
  const idx = Math.floor(rng() * arr.length);
  const clamped = Math.min(Math.max(idx, 0), arr.length - 1);
  const value = arr[clamped];
  if (value === undefined) {
    throw new Error("pickOne: empty array");
  }
  return value;
}

export interface PromptParts {
  readonly style: string;
  readonly tractor: string;
  readonly setting: string;
  readonly quirk: string;
  readonly mood: string;
}

export function buildPromptParts(rng: () => number = Math.random): PromptParts {
  return {
    style: pickOne(rng, STYLES),
    tractor: pickOne(rng, TRACTORS),
    setting: pickOne(rng, SETTINGS),
    quirk: pickOne(rng, MONKEY_QUIRKS),
    mood: pickOne(rng, MOODS),
  };
}

export function renderPrompt(parts: PromptParts): string {
  return (
    `A ${parts.style} of a monkey driving a ${parts.tractor} ${parts.setting}. ` +
    `The monkey is ${parts.quirk}, ${parts.mood}. ` +
    `High detail, clearly the monkey is the driver behind the wheel.`
  );
}
