import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { formatStickerText } from "../src/domain/sticker.js";

describe("formatStickerText", () => {
  it("emoji + set name", () => {
    assert.equal(
      formatStickerText({ emoji: "😭", set_name: "PepeReactions" }),
      "[sticker 😭 from PepeReactions]",
    );
  });

  it("emoji only (no set name)", () => {
    assert.equal(formatStickerText({ emoji: "🔥" }), "[sticker 🔥]");
  });

  it("missing emoji falls back to generic picture token", () => {
    assert.equal(
      formatStickerText({ set_name: "PepeReactions" }),
      "[sticker 🖼 from PepeReactions]",
    );
  });

  it("empty set name is treated as missing", () => {
    assert.equal(formatStickerText({ emoji: "🎉", set_name: "" }), "[sticker 🎉]");
  });

  it("no emoji and no set name", () => {
    assert.equal(formatStickerText({}), "[sticker 🖼]");
  });
});
