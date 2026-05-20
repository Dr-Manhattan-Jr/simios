import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  ImageOcrResultSchema,
  ImageRecordSchema,
  type ImageRecord,
} from "../src/domain/image.js";

function imageRow(
  over: Partial<ImageRecord> & { message_id: number },
): ImageRecord {
  return {
    kind: "photo",
    file_id: "AgACfile",
    mime_type: "image/jpeg",
    sent_at: "2026-05-20T12:00:00.000Z",
    user_id: 1,
    first_name: "Alice",
    caption: "",
    sticker_meta: "",
    status: "pending",
    attempts: 0,
    description: "",
    ocr_text: "",
    processed_at: "",
    ...over,
  };
}

describe("ImageRecordSchema", () => {
  it("accepts a valid pending photo row", () => {
    assert.equal(
      ImageRecordSchema.safeParse(imageRow({ message_id: 1 })).success,
      true,
    );
  });

  it("accepts a valid sticker row", () => {
    const row = imageRow({
      message_id: 1,
      kind: "sticker",
      mime_type: "image/webp",
      sticker_meta: "😭 from PepeReactions",
    });
    assert.equal(ImageRecordSchema.safeParse(row).success, true);
  });

  it("rejects an unknown kind", () => {
    const bad = { ...imageRow({ message_id: 1 }), kind: "video" };
    assert.equal(ImageRecordSchema.safeParse(bad).success, false);
  });

  it("rejects an unknown status", () => {
    const bad = { ...imageRow({ message_id: 1 }), status: "queued" };
    assert.equal(ImageRecordSchema.safeParse(bad).success, false);
  });

  it("rejects a negative attempts count", () => {
    const bad = imageRow({ message_id: 1, attempts: -1 });
    assert.equal(ImageRecordSchema.safeParse(bad).success, false);
  });

  it("rejects a non-positive message_id", () => {
    const bad = imageRow({ message_id: 0 });
    assert.equal(ImageRecordSchema.safeParse(bad).success, false);
  });

  it("rejects a missing file_id", () => {
    const { file_id: _omit, ...bad } = imageRow({ message_id: 1 });
    assert.equal(ImageRecordSchema.safeParse(bad).success, false);
  });
});

describe("ImageOcrResultSchema", () => {
  it("accepts a description + ocr_text pair", () => {
    const r = ImageOcrResultSchema.safeParse({
      description: "A cat on a table",
      ocr_text: "",
    });
    assert.equal(r.success, true);
  });

  it("accepts empty strings for both fields", () => {
    const r = ImageOcrResultSchema.safeParse({
      description: "",
      ocr_text: "",
    });
    assert.equal(r.success, true);
  });

  it("rejects a missing ocr_text field", () => {
    const r = ImageOcrResultSchema.safeParse({ description: "x" });
    assert.equal(r.success, false);
  });

  it("rejects a non-string field", () => {
    const r = ImageOcrResultSchema.safeParse({
      description: "x",
      ocr_text: 42,
    });
    assert.equal(r.success, false);
  });
});
