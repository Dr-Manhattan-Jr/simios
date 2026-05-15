import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("module loading smoke test", () => {
  it("loads all domain and gemini modules", async () => {
    const [day, language, cooldown, prompt, text] = await Promise.all([
      import("../src/domain/day.js"),
      import("../src/domain/language.js"),
      import("../src/domain/cooldown.js"),
      import("../src/domain/prompt.js"),
      import("../src/gemini/text.js"),
    ]);
    assert.equal(typeof day.isFriday, "function");
    assert.equal(typeof language.detectLanguage, "function");
    assert.equal(typeof cooldown.createCooldown, "function");
    assert.equal(typeof prompt.buildUserPrompt, "function");
    assert.equal(typeof text.createGeminiTextClient, "function");
  });
});
