import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { formatImageText } from "../src/domain/photo.js";

// Unicode bidi-override (U+202E) — a classic prompt-injection vector,
// built from an escape so no literal control char sits in the source.
const BIDI_OVERRIDE = "‮";

describe("formatImageText — photo", () => {
  it("bare placeholder when nothing is known", () => {
    const out = formatImageText({
      kind: "photo",
      description: "",
      ocrText: "",
      caption: "",
      stickerMeta: "",
    });
    assert.equal(out, "[photo]");
  });

  it("placeholder with caption only (capture time)", () => {
    const out = formatImageText({
      kind: "photo",
      description: "",
      ocrText: "",
      caption: "look at this",
      stickerMeta: "",
    });
    assert.equal(out, '[photo: caption: "look at this"]');
  });

  it("full done form — description + ocr + caption", () => {
    const out = formatImageText({
      kind: "photo",
      description: "A screenshot of a chat",
      ocrText: "hello world",
      caption: "found this",
      stickerMeta: "",
    });
    assert.equal(
      out,
      '[photo: A screenshot of a chat | text in image: hello world | caption: "found this"]',
    );
  });

  it("omits the ocr segment when there is no text in the image", () => {
    const out = formatImageText({
      kind: "photo",
      description: "A sunset over the sea",
      ocrText: "",
      caption: "",
      stickerMeta: "",
    });
    assert.equal(out, "[photo: A sunset over the sea]");
  });

  it("strips control characters (bidi override) from the description", () => {
    const out = formatImageText({
      kind: "photo",
      description: `evil ${BIDI_OVERRIDE}text`,
      ocrText: "",
      caption: "",
      stickerMeta: "",
    });
    assert.equal(out.includes(BIDI_OVERRIDE), false);
    assert.equal(out, "[photo: evil text]");
  });
});

describe("formatImageText — sticker", () => {
  it("keeps the emoji+set prefix and appends the description", () => {
    const out = formatImageText({
      kind: "sticker",
      description: "A cartoon frog looking smug",
      ocrText: "",
      caption: "",
      stickerMeta: "😏 from FrogPack",
    });
    assert.equal(
      out,
      "[sticker 😏 from FrogPack: A cartoon frog looking smug]",
    );
  });

  it("appends ocr text from a sticker that contains words", () => {
    const out = formatImageText({
      kind: "sticker",
      description: "A meme sticker",
      ocrText: "NO",
      caption: "",
      stickerMeta: "🙅 from Memes",
    });
    assert.match(out, /text in image: NO/);
  });

  it("falls back to a bare [sticker] when meta is empty", () => {
    const out = formatImageText({
      kind: "sticker",
      description: "",
      ocrText: "",
      caption: "",
      stickerMeta: "",
    });
    assert.equal(out, "[sticker]");
  });
});
