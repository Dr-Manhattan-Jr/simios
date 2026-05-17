# @simios/sheets-client

Thin googleapis wrapper for service-account-authenticated Google Sheets I/O, plus a `defineTable` factory that lets each bot describe a sheet tab once and get typed CRUD for free.

## Exports

### `createSheetsClient({ credentials, spreadsheetId })`

Returns a `SheetsClient` with five methods: `readAll(tab)`, `append(tab, row)`, `updateRow(tab, rowIndex, row)`, `deleteRow(tab, rowIndex)`, `ensureTab(tab, header)`. All async. `rowIndex` is 1-indexed (row 1 = header).

```ts
import { createSheetsClient } from "@simios/sheets-client";

const sheets = createSheetsClient({
  credentials: config.serviceAccount,
  spreadsheetId: config.sheetId,
});
```

### `ServiceAccountCredentialsSchema`

Zod schema for the JSON Google downloads when you create a service-account key. Requires `client_email` and `private_key`; passthrough on the rest. Pair with `@simios/env`'s `JsonObject`:

```ts
GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(ServiceAccountCredentialsSchema),
```

### `defineTable(client, { tab, header, parseRow, rowFromEntry, keyOf, keysEqual })`

The main reason this package exists. Pass a sheet tab description, get back a typed `Table<TEntry, TKey>` with `listAll()`, `findByKey()`, `upsert()`, `removeByKey()`, `ensure()`. Each bot's `sheets/<tab>.ts` file is a single `createTable(client)` factory that calls `defineTable` — no hand-rolled CRUD.

```ts
import { defineTable } from "@simios/sheets-client";

export function createTable(client: SheetsClient) {
  return defineTable(client, {
    tab: "log",
    header: ["iso_week", "user_id", "lift", "weight_kg", "made"],
    parseRow(row, rowNumber) {
      const parsed = LogRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new Error(`Invalid log row at sheet row ${String(rowNumber)}: ${parsed.error.message}`);
      }
      return parsed.data;
    },
    rowFromEntry: (e) => [e.iso_week, String(e.user_id), e.lift, String(e.weight_kg), e.made ? "true" : "false"],
    keyOf: (e) => ({ isoWeek: e.iso_week, userId: e.user_id, lift: e.lift }),
    keysEqual: (a, b) => a.isoWeek === b.isoWeek && a.userId === b.userId && a.lift === b.lift,
  });
}
```

### `withOptional(base, key, value)`

Helper to build object literals where an optional property should be **omitted** (not set to `undefined`) when its source value is empty. Required because `exactOptionalPropertyTypes: true` distinguishes the two — the codebase preference is omission.

```ts
const entry = withOptional({ user_id: 1, lift: "bench" }, "username", ctx.from?.username);
// → { user_id: 1, lift: "bench" } when username is undefined/empty
// → { user_id: 1, lift: "bench", username: "alice" } otherwise
```

## Gotchas

- `readAll(tab)` reads `A2:Z` — assumes headers are in row 1 and data starts at row 2.
- Sheets returns short rows when trailing cells are empty. The bots' `parseRow` implementations pad the row to the header width before parsing.
- `deleteRow` does a `batchUpdate` because `values.delete` doesn't shift rows up; the bots rely on shift-up behaviour.

## See also

- [`apps/ciclobot/src/sheets/`](../../apps/ciclobot/src/sheets) — three real-world `defineTable` call sites (participants, log, bodyweight).
- [`apps/los_piratas_bot/src/sheets/`](../../apps/los_piratas_bot/src/sheets) — two more (members, events).
