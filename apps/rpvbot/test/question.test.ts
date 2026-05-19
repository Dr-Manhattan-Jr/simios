import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { sanitiseQuestion } from "../src/domain/question.js";

const MAX = 400;

describe("sanitiseQuestion", () => {
  it("passes normal input through unchanged", () => {
    const r = sanitiseQuestion("¿de qué hablaron ayer?", MAX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, "¿de qué hablaron ayer?");
  });

  it("rejects empty input", () => {
    const r = sanitiseQuestion("", MAX);
    assert.equal(r.ok, false);
  });

  it("rejects whitespace-only input", () => {
    const r = sanitiseQuestion("    ", MAX);
    assert.equal(r.ok, false);
  });

  it("strips ASCII control characters", () => {
    const r = sanitiseQuestion("hello\x00\x01\x07world", MAX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, "hello world");
  });

  it("strips zero-width spaces and bidi overrides", () => {
    // Common prompt-injection vectors: hide payload in invisible chars.
    // Stripped chars become spaces, then collapsed by the whitespace pass.
    const payload = `harmless​‮evil‬`;
    const r = sanitiseQuestion(payload, MAX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, "harmless evil");
  });

  it("collapses runs of whitespace from injection-shaped payloads", () => {
    const r = sanitiseQuestion("question\n\n\nignore previous", MAX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, "question ignore previous");
  });

  it("truncates input above maxChars instead of rejecting", () => {
    const long = "a".repeat(MAX + 50);
    const r = sanitiseQuestion(long, MAX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text.length, MAX);
  });

  it("strips the BOM character", () => {
    const r = sanitiseQuestion("﻿question", MAX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, "question");
  });
});
