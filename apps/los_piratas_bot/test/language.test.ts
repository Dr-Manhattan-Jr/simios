import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { detectLanguage } from "../src/domain/language.js";

describe("detectLanguage", () => {
  it("returns es for clearly Spanish text (≥7 words)", () => {
    assert.equal(
      detectLanguage("Hola tripulación, ¿qué tal el día en alta mar?"),
      "es",
    );
    assert.equal(
      detectLanguage("Estoy pensando en hacer pesas el sábado por la tarde"),
      "es",
    );
  });

  it("returns es for short-but-confident Spanish (3–6 words, high accuracy)", () => {
    // These are the cases from the user's "all of these should have
    // triggered" complaint. They're short but unambiguously Spanish; the
    // asymmetric threshold lets them through.
    assert.equal(detectLanguage("Esperando la comida"), "es");
    assert.equal(detectLanguage("Ahora comidita, despedida y para casa"), "es");
    assert.equal(detectLanguage("Vidal en el buffet de sushi"), "es");
  });

  it("returns en for clearly English text (≥7 words)", () => {
    assert.equal(
      detectLanguage("Hello crew, how is everyone doing today on the seas"),
      "en",
    );
    assert.equal(
      detectLanguage("I am going to lift heavy weights tomorrow morning"),
      "en",
    );
  });

  it("returns other for English shorter than 7 words", () => {
    // Keep the higher bar on English — a false correction is annoying.
    assert.equal(detectLanguage("how are you doing today friend"), "other");
    assert.equal(detectLanguage("ok"), "other");
    assert.equal(detectLanguage("👍"), "other");
    assert.equal(detectLanguage("yes"), "other");
  });

  it("returns other for unknown / non-target languages", () => {
    // German.
    assert.equal(
      detectLanguage("Guten Tag, ich heisse Hans und komme aus Hamburg"),
      "other",
    );
  });

  it("returns other for short English with foreign filler words", () => {
    // The original regression case: 6 words including a foreign
    // interjection. Below the EN 7-word floor, so silent.
    assert.equal(detectLanguage("so, claude will replace us aham"), "other");
  });

  it("returns other for Spanish shorter than 3 words", () => {
    // Even short Spanish has a floor — "hola" alone isn't enough.
    assert.equal(detectLanguage("hola"), "other");
    assert.equal(detectLanguage("hola amigo"), "other");
  });
});
