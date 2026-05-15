import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Row, SheetsClient } from "@simios/sheets-client";
import {
  createTable,
  HEADER,
  TAB,
} from "../src/sheets/members.js";

function fakeClient(): SheetsClient & { tabs: Map<string, Row[]> } {
  const tabs = new Map<string, Row[]>();
  return {
    tabs,
    async readAll(tab) {
      return tabs.get(tab) ?? [];
    },
    async append(tab, row) {
      const existing = tabs.get(tab) ?? [];
      tabs.set(tab, [...existing, row]);
    },
    async updateRow(tab, rowIndex, row) {
      const arr = [...(tabs.get(tab) ?? [])];
      arr[rowIndex - 2] = row;
      tabs.set(tab, arr);
    },
    async deleteRow(tab, rowIndex) {
      const arr = [...(tabs.get(tab) ?? [])];
      arr.splice(rowIndex - 2, 1);
      tabs.set(tab, arr);
    },
    async ensureTab(tab) {
      if (!tabs.has(tab)) tabs.set(tab, []);
    },
  };
}

describe("members table", () => {
  it("exposes the expected tab name and header", () => {
    assert.equal(TAB, "piratas_members");
    assert.deepEqual(HEADER, [
      "user_id",
      "username",
      "first_name",
      "joined_at",
      "left_at",
    ]);
  });

  it("upserts new members and re-upsert overwrites the same row", async () => {
    const client = fakeClient();
    const table = createTable(client);
    await table.upsert({
      user_id: 1,
      username: "alice",
      first_name: "Alice",
      joined_at: "2026-05-15T12:00:00Z",
    });
    await table.upsert({
      user_id: 2,
      first_name: "Bob",
      joined_at: "2026-05-15T12:01:00Z",
    });
    assert.equal((await table.listAll()).length, 2);

    // Re-upsert with left_at — should overwrite, not append.
    await table.upsert({
      user_id: 1,
      username: "alice",
      first_name: "Alice",
      joined_at: "2026-05-15T12:00:00Z",
      left_at: "2026-05-16T12:00:00Z",
    });
    const all = await table.listAll();
    assert.equal(all.length, 2);
    const alice = all.find((m) => m.user_id === 1);
    assert.equal(alice?.left_at, "2026-05-16T12:00:00Z");
  });

  it("findByKey returns the entry or undefined", async () => {
    const client = fakeClient();
    const table = createTable(client);
    await table.upsert({
      user_id: 42,
      first_name: "X",
      joined_at: "2026-05-15T12:00:00Z",
    });
    const found = await table.findByKey(42);
    assert.equal(found?.user_id, 42);
    assert.equal(await table.findByKey(99), undefined);
  });
});
