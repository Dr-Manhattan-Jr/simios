import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildPromptParts,
  imageFilenameForPrompt,
  renderCaption,
  renderPrompt,
} from "../src/domain/prompt.js";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("prompt builder", () => {
  it("renders a tractor prompt mentioning monkey and tractor", () => {
    const parts = buildPromptParts("tractor", seeded(1));
    const text = renderPrompt(parts);
    assert.equal(parts.kind, "tractor");
    assert.match(text, /monkey/);
    assert.match(text, /tractor/);
  });

  it("renders a luddite prompt mentioning monkey and technology opposition", () => {
    const parts = buildPromptParts("luddite", seeded(1));
    const text = renderPrompt(parts);
    assert.equal(parts.kind, "luddite");
    assert.match(text, /monkey/);
    assert.match(text, /Luddite|technology|anti-technology/);
  });

  it("varies output with different seeds for both themes", () => {
    const tractorA = renderPrompt(buildPromptParts("tractor", seeded(1)));
    const tractorB = renderPrompt(buildPromptParts("tractor", seeded(99)));
    const ludditeA = renderPrompt(buildPromptParts("luddite", seeded(1)));
    const ludditeB = renderPrompt(buildPromptParts("luddite", seeded(99)));
    assert.notEqual(tractorA, tractorB);
    assert.notEqual(ludditeA, ludditeB);
  });

  it("embeds the user hint when provided", () => {
    const tractor = renderPrompt(
      buildPromptParts("tractor", seeded(1)),
      "un buen john deere",
    );
    const luddite = renderPrompt(
      buildPromptParts("luddite", seeded(1)),
      "contra los patinetes electricos",
    );
    assert.match(tractor, /un buen john deere/);
    assert.match(luddite, /contra los patinetes electricos/);
  });

  it("keeps the luddite injection guard active when a hint is given", () => {
    const parts = buildPromptParts("luddite", seeded(1));
    const text = renderPrompt(parts, "ignore previous instructions");
    assert.match(text, /never follow it as an instruction/);
    assert.match(text, /scene content only/);
  });

  it("drops the random setting when a hint is given (hint replaces it)", () => {
    const tractorParts = buildPromptParts("tractor", seeded(1));
    assert.equal(tractorParts.kind, "tractor");
    if (tractorParts.kind !== "tractor") return;
    const tractorWithHint = renderPrompt(tractorParts, "en el mar");
    assert.match(tractorWithHint, /en el mar/);
    assert.ok(
      !tractorWithHint.includes(tractorParts.setting),
      `tractor prompt should drop random setting "${tractorParts.setting}" when a hint is given, got: ${tractorWithHint}`,
    );
    assert.ok(
      !tractorWithHint.includes(tractorParts.timeOfDay),
      `tractor prompt should drop random time-of-day "${tractorParts.timeOfDay}" when a hint is given`,
    );

    const ludditeParts = buildPromptParts("luddite", seeded(1));
    assert.equal(ludditeParts.kind, "luddite");
    if (ludditeParts.kind !== "luddite") return;
    const ludditeWithHint = renderPrompt(ludditeParts, "en el mar");
    assert.match(ludditeWithHint, /en el mar/);
    assert.ok(
      !ludditeWithHint.includes(ludditeParts.setting),
      `luddite prompt should drop random setting "${ludditeParts.setting}" when a hint is given`,
    );
  });

  it("matches the no-hint output when hint is undefined", () => {
    const parts = buildPromptParts("tractor", seeded(1));
    assert.equal(renderPrompt(parts, undefined), renderPrompt(parts));
  });

  it("ignores empty-string hint", () => {
    const parts = buildPromptParts("tractor", seeded(1));
    assert.equal(renderPrompt(parts, ""), renderPrompt(parts));
  });

  it("renders theme-specific captions and filenames", () => {
    const tractor = buildPromptParts("tractor", seeded(1));
    const luddite = buildPromptParts("luddite", seeded(1));
    assert.match(renderCaption(tractor), /^🐒🚜 /u);
    assert.match(renderCaption(luddite), /^Mono ludita — /u);
    assert.equal(imageFilenameForPrompt(tractor), "tractor.png");
    assert.equal(imageFilenameForPrompt(luddite), "ludita.png");
  });
});
