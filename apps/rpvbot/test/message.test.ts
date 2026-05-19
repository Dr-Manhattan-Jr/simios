import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  decodeNewlines,
  encodeNewlines,
} from "../src/domain/message.js";

describe("encodeNewlines / decodeNewlines", () => {
  it("encodes \\n, \\r, and \\r\\n to the literal two-char sequence", () => {
    assert.equal(encodeNewlines("a\nb"), "a\\nb");
    assert.equal(encodeNewlines("a\r\nb"), "a\\nb");
    assert.equal(encodeNewlines("a\rb"), "a\\nb");
  });

  it("round-trips through decode", () => {
    const original = "line1\nline2\r\nline3";
    assert.equal(decodeNewlines(encodeNewlines(original)), "line1\nline2\nline3");
  });

  it("leaves text without newlines untouched", () => {
    assert.equal(encodeNewlines("hello world"), "hello world");
    assert.equal(decodeNewlines("hello world"), "hello world");
  });
});
