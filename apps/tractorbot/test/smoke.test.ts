import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("module loading smoke test", () => {
  it("loads domain modules", async () => {
    const [prompt, trigger, monkey] = await Promise.all([
      import("../src/domain/prompt.js"),
      import("../src/domain/trigger.js"),
      import("../src/domain/monkey-talk.js"),
    ]);
    assert.equal(typeof prompt.buildPromptParts, "function");
    assert.equal(typeof prompt.renderPrompt, "function");
    assert.equal(typeof trigger.matchesTrigger, "function");
    assert.equal(typeof monkey.pickMonkeyPhrase, "function");
  });

  it("loads the gemini client factory", async () => {
    const mod = await import("../src/gemini/image.js");
    assert.equal(typeof mod.createGeminiImageClient, "function");
  });
});
