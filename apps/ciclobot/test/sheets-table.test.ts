import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
} from "@simios/sheets-client";

interface FakeRow {
  id: number;
  name?: string;
}

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
      // rowIndex is 1-indexed where 1 = header; data rows start at index 0 in this fake (which models A2:Z).
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

describe("defineTable", () => {
  it("upserts new rows and replaces existing ones", async () => {
    const client = fakeClient();
    const table = defineTable<FakeRow, number>(client, {
      tab: "fake",
      header: ["id", "name"],
      parseRow(row) {
        const idRaw = row[0] ?? "";
        const name = row[1] ?? "";
        const base = { id: Number(idRaw) };
        return name.length > 0 ? { ...base, name } : base;
      },
      rowFromEntry(e) {
        return [String(e.id), e.name ?? ""];
      },
      keyOf: (e) => e.id,
      keysEqual: (a, b) => a === b,
    });

    await table.upsert({ id: 1, name: "alice" });
    await table.upsert({ id: 2, name: "bob" });
    assert.deepEqual(client.tabs.get("fake"), [
      ["1", "alice"],
      ["2", "bob"],
    ]);

    await table.upsert({ id: 1, name: "alicia" });
    assert.deepEqual(client.tabs.get("fake"), [
      ["1", "alicia"],
      ["2", "bob"],
    ]);
  });

  it("findByKey returns the entry or undefined", async () => {
    const client = fakeClient();
    const table = defineTable<FakeRow, number>(client, {
      tab: "fake",
      header: ["id", "name"],
      parseRow(row) {
        const id = Number(row[0] ?? "0");
        return { id };
      },
      rowFromEntry: (e) => [String(e.id), ""],
      keyOf: (e) => e.id,
      keysEqual: (a, b) => a === b,
    });
    await table.upsert({ id: 42 });
    assert.deepEqual(await table.findByKey(42), { id: 42 });
    assert.equal(await table.findByKey(99), undefined);
  });

  it("removeByKey removes and returns true; false when missing", async () => {
    const client = fakeClient();
    const table = defineTable<FakeRow, number>(client, {
      tab: "fake",
      header: ["id"],
      parseRow: (row) => ({ id: Number(row[0] ?? "0") }),
      rowFromEntry: (e) => [String(e.id)],
      keyOf: (e) => e.id,
      keysEqual: (a, b) => a === b,
    });
    await table.upsert({ id: 1 });
    await table.upsert({ id: 2 });
    assert.equal(await table.removeByKey(1), true);
    assert.deepEqual(client.tabs.get("fake"), [["2"]]);
    assert.equal(await table.removeByKey(99), false);
  });

  it("skips empty rows during listAll", async () => {
    const client = fakeClient();
    client.tabs.set("fake", [["1"], ["", ""], ["2"]]);
    const table = defineTable<FakeRow, number>(client, {
      tab: "fake",
      header: ["id"],
      parseRow: (row) => ({ id: Number(row[0] ?? "0") }),
      rowFromEntry: (e) => [String(e.id)],
      keyOf: (e) => e.id,
      keysEqual: (a, b) => a === b,
    });
    const all = await table.listAll();
    assert.deepEqual(
      all.map((e) => e.id),
      [1, 2],
    );
  });
});

describe("withOptional", () => {
  it("adds the key when value is a non-empty string", () => {
    const result = withOptional({ a: 1 }, "name", "bob");
    assert.deepEqual(result, { a: 1, name: "bob" });
  });
  it("leaves base alone when value is undefined", () => {
    const base = { a: 1 };
    const result = withOptional(base, "name", undefined);
    assert.deepEqual(result, base);
  });
  it("leaves base alone when value is empty string", () => {
    const result = withOptional({ a: 1 }, "name", "");
    assert.deepEqual(result, { a: 1 });
  });
});
