import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { detectLanguage } from "../src/domain/language.js";

describe("detectLanguage", () => {
  it("returns es for clearly Spanish text", () => {
    assert.equal(
      detectLanguage("Hola tripulación, ¿qué tal el día en alta mar?"),
      "es",
    );
    assert.equal(
      detectLanguage("Estoy pensando en hacer pesas el sábado por la tarde"),
      "es",
    );
  });

  it("returns en for clearly English text", () => {
    assert.equal(
      detectLanguage("Hello crew, how is everyone doing today on the seas"),
      "en",
    );
    assert.equal(
      detectLanguage("I am going to lift heavy weights tomorrow morning"),
      "en",
    );
  });

  it("returns other for fewer than 7 words (regardless of content)", () => {
    assert.equal(detectLanguage("ok"), "other");
    assert.equal(detectLanguage("👍"), "other");
    assert.equal(detectLanguage("yes"), "other");
    assert.equal(detectLanguage("hola que tal todo bien"), "other");
    assert.equal(detectLanguage("how are you doing today friend"), "other");
  });

  it("returns other for unknown / non-target languages", () => {
    // German.
    assert.equal(detectLanguage("Guten Tag, ich heisse Hans und komme aus Hamburg"), "other");
  });

  it("returns other for borderline short English with foreign filler words", () => {
    // The original bug: "so, claude will replace us aham" — 6 words but the
    // foreign interjection "aham" plus the name throws tinyld off enough
    // that the top guess is below the confidence floor, OR the top guess
    // isn't en/es at all. Either way we want "other", not a wrong trigger.
    assert.equal(
      detectLanguage("so, claude will replace us aham"),
      "other",
    );
  });
});
