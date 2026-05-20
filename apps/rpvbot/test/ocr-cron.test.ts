import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { selectPending } from "../src/crons/ocr-images.js";
import { MAX_OCR_ATTEMPTS } from "../src/domain/cap.js";
import type { ImageRecord, ImageStatus } from "../src/domain/image.js";

function img(
  over: Partial<ImageRecord> & { message_id: number },
): ImageRecord {
  return {
    kind: "photo",
    file_id: "f",
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

describe("selectPending", () => {
  it("returns empty when nothing is pending or retryable", () => {
    const all: ImageRecord[] = [
      img({ message_id: 1, status: "done" }),
      img({ message_id: 2, status: "skipped" }),
    ];
    assert.equal(selectPending(all, 20).length, 0);
  });

  it("includes pending rows", () => {
    const all = [img({ message_id: 1, status: "pending" })];
    assert.equal(selectPending(all, 20).length, 1);
  });

  it("includes failed rows still under the retry cap", () => {
    const all = [
      img({ message_id: 1, status: "failed", attempts: MAX_OCR_ATTEMPTS - 1 }),
    ];
    assert.equal(selectPending(all, 20).length, 1);
  });

  it("excludes failed rows at or over the retry cap", () => {
    const all = [
      img({ message_id: 1, status: "failed", attempts: MAX_OCR_ATTEMPTS }),
      img({ message_id: 2, status: "failed", attempts: MAX_OCR_ATTEMPTS + 5 }),
    ];
    assert.equal(selectPending(all, 20).length, 0);
  });

  it("excludes done and skipped rows", () => {
    const statuses: ImageStatus[] = ["done", "skipped"];
    for (const status of statuses) {
      const all = [img({ message_id: 1, status })];
      assert.equal(selectPending(all, 20).length, 0);
    }
  });

  it("orders oldest sent_at first", () => {
    const all = [
      img({ message_id: 2, sent_at: "2026-05-20T18:00:00.000Z" }),
      img({ message_id: 1, sent_at: "2026-05-20T08:00:00.000Z" }),
      img({ message_id: 3, sent_at: "2026-05-20T12:00:00.000Z" }),
    ];
    const ordered = selectPending(all, 20).map((i) => i.message_id);
    assert.deepEqual(ordered, [1, 3, 2]);
  });

  it("caps the result at maxPerRun", () => {
    const all = Array.from({ length: 50 }, (_, i) =>
      img({ message_id: i + 1 }),
    );
    assert.equal(selectPending(all, 20).length, 20);
  });

  it("the cap keeps the oldest, not an arbitrary slice", () => {
    const all = [
      img({ message_id: 1, sent_at: "2026-05-20T01:00:00.000Z" }),
      img({ message_id: 2, sent_at: "2026-05-20T02:00:00.000Z" }),
      img({ message_id: 3, sent_at: "2026-05-20T03:00:00.000Z" }),
    ];
    const ordered = selectPending(all, 2).map((i) => i.message_id);
    assert.deepEqual(ordered, [1, 2]);
  });
});
