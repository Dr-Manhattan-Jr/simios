import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  FRIDAY_END,
  FRIDAY_START,
} from "../src/domain/announcements.js";

describe("announcements", () => {
  it("FRIDAY_START mentions English and is non-trivial", () => {
    assert.ok(FRIDAY_START.length > 50);
    assert.ok(/english/i.test(FRIDAY_START));
  });
  it("FRIDAY_END signals the end and is non-trivial", () => {
    assert.ok(FRIDAY_END.length > 30);
    assert.ok(/sábado|saturday|fin|acaba|end/i.test(FRIDAY_END));
  });
});
