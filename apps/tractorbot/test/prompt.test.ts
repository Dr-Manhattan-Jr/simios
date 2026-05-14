import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildPromptParts, renderPrompt } from "../src/domain/prompt.js";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("prompt builder", () => {
  it("renders a prompt mentioning monkey and tractor", () => {
    const parts = buildPromptParts(seeded(1));
    const text = renderPrompt(parts);
    assert.match(text, /monkey/);
    assert.match(text, /tractor/);
  });

  it("varies output with different seeds", () => {
    const a = renderPrompt(buildPromptParts(seeded(1)));
    const b = renderPrompt(buildPromptParts(seeded(99)));
    assert.notEqual(a, b);
  });

  it("embeds the user hint when provided", () => {
    const parts = buildPromptParts(seeded(1));
    const text = renderPrompt(parts, "un buen john deere");
    assert.match(text, /un buen john deere/);
  });

  it("matches the no-hint output when hint is undefined", () => {
    const parts = buildPromptParts(seeded(1));
    assert.equal(renderPrompt(parts, undefined), renderPrompt(parts));
  });

  it("ignores empty-string hint", () => {
    const parts = buildPromptParts(seeded(1));
    assert.equal(renderPrompt(parts, ""), renderPrompt(parts));
  });
});
