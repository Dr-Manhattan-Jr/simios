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

  it("returns other for very short text", () => {
    assert.equal(detectLanguage("ok"), "other");
    assert.equal(detectLanguage("👍"), "other");
    assert.equal(detectLanguage("yes"), "other");
  });

  it("returns other for unknown / non-target languages", () => {
    // German.
    assert.equal(detectLanguage("Guten Tag, ich heisse Hans und komme aus Hamburg"), "other");
  });
});
