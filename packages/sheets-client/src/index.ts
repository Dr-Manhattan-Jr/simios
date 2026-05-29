import { google, sheets_v4 } from "googleapis";
import { z } from "zod";

export const ServiceAccountCredentialsSchema = z
  .object({
    client_email: z.string().min(1),
    private_key: z.string().min(1),
  })
  .passthrough();
export type ServiceAccountCredentials = z.infer<
  typeof ServiceAccountCredentialsSchema
>;

export type Row = ReadonlyArray<string>;

export interface SheetsClient {
  /** Read every row (excluding header) from a tab. */
  readAll(tab: string): Promise<Row[]>;
  /** Append a single row to the end of a tab. */
  append(tab: string, row: Row): Promise<void>;
  /** Overwrite a single 1-indexed row (1 = header). */
  updateRow(tab: string, rowIndex: number, row: Row): Promise<void>;
  /** Delete a 1-indexed row. */
  deleteRow(tab: string, rowIndex: number): Promise<void>;
  /** Ensure the tab exists with the given header; create the tab and/or write the header if missing. */
  ensureTab(tab: string, header: Row): Promise<void>;
}

export function createSheetsClient(args: {
  credentials: ServiceAccountCredentials;
  spreadsheetId: string;
}): SheetsClient {
  const auth = new google.auth.JWT({
    email: args.credentials.client_email,
    key: args.credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const api = google.sheets({ version: "v4", auth });
  const spreadsheetId = args.spreadsheetId;

  async function getSheetId(tab: string): Promise<number | undefined> {
    const meta = await api.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find(
      (s: sheets_v4.Schema$Sheet) => s.properties?.title === tab,
    );
    return sheet?.properties?.sheetId ?? undefined;
  }

  return {
    async readAll(tab) {
      const res = await api.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!A2:Z`,
      });
      const values = res.data.values ?? [];
      return values.map((row): Row => row.map((cell) => String(cell ?? "")));
    },

    async append(tab, row) {
      await api.spreadsheets.values.append({
        spreadsheetId,
        range: `${tab}!A:Z`,
        valueInputOption: "RAW",
        requestBody: { values: [[...row]] },
      });
    },

    async updateRow(tab, rowIndex, row) {
      await api.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[...row]] },
      });
    },

    async deleteRow(tab, rowIndex) {
      const sheetId = await getSheetId(tab);
      if (sheetId === undefined) {
        throw new Error(`Tab not found: ${tab}`);
      }
      await api.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });
    },

    async ensureTab(tab, header) {
      const sheetId = await getSheetId(tab);
      if (sheetId === undefined) {
        await api.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: tab } } }],
          },
        });
        await api.spreadsheets.values.update({
          spreadsheetId,
          range: `${tab}!A1:Z1`,
          valueInputOption: "RAW",
          requestBody: { values: [[...header]] },
        });
        return;
      }
      const existing = await api.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!A1:Z1`,
      });
      const firstRow = existing.data.values?.[0] ?? [];
      if (firstRow.length === 0) {
        await api.spreadsheets.values.update({
          spreadsheetId,
          range: `${tab}!A1:Z1`,
          valueInputOption: "RAW",
          requestBody: { values: [[...header]] },
        });
      }
    },
  };
}

/**
 * Build object literal with `key` set to `value` only when `value` is a
 * non-empty string. Avoids the `exactOptionalPropertyTypes` pitfall of
 * explicitly assigning `undefined`.
 */
export function withOptional<T extends object, K extends string>(
  base: T,
  key: K,
  value: string | undefined,
): T | (T & Record<K, string>) {
  if (value === undefined || value.length === 0) return base;
  return { ...base, [key]: value };
}

export interface TableDefinition<TEntry, TKey> {
  tab: string;
  header: Row;
  /** Parse a raw row (string cells, may be short — padded internally) into a domain entry. */
  parseRow(raw: Row, rowNumber: number): TEntry;
  /** Render a domain entry as a sheet row. */
  rowFromEntry(entry: TEntry): Row;
  /** Extract the unique key for matching existing rows. */
  keyOf(entry: TEntry): TKey;
  /** Compare two keys for equality. */
  keysEqual(a: TKey, b: TKey): boolean;
}

export interface Table<TEntry, TKey> {
  readonly tab: string;
  readonly header: Row;
  ensure(): Promise<void>;
  listAll(): Promise<TEntry[]>;
  findByKey(key: TKey): Promise<TEntry | undefined>;
  upsert(entry: TEntry): Promise<void>;
  /**
   * Append a row unconditionally, without the read-then-dedup that `upsert`
   * does. Use this for append-only tables whose key is unique by construction
   * (so there is never an existing row to overwrite) — it saves a full-tab read
   * on every write.
   */
  append(entry: TEntry): Promise<void>;
  removeByKey(key: TKey): Promise<boolean>;
}

export function defineTable<TEntry, TKey>(
  client: SheetsClient,
  def: TableDefinition<TEntry, TKey>,
): Table<TEntry, TKey> {
  async function listIndexed(): Promise<
    { entry: TEntry; rowIndex: number }[]
  > {
    const raw = await client.readAll(def.tab);
    const out: { entry: TEntry; rowIndex: number }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      if (row === undefined) continue;
      if (row.every((c) => c.length === 0)) continue;
      const rowNumber = i + 2;
      const entry = def.parseRow(row, rowNumber);
      out.push({ entry, rowIndex: rowNumber });
    }
    return out;
  }

  return {
    tab: def.tab,
    header: def.header,
    async ensure() {
      await client.ensureTab(def.tab, def.header);
    },
    async listAll() {
      const indexed = await listIndexed();
      return indexed.map((r) => r.entry);
    },
    async findByKey(key) {
      const indexed = await listIndexed();
      return indexed.find((r) => def.keysEqual(def.keyOf(r.entry), key))?.entry;
    },
    async upsert(entry) {
      const indexed = await listIndexed();
      const key = def.keyOf(entry);
      const existing = indexed.find((r) =>
        def.keysEqual(def.keyOf(r.entry), key),
      );
      const row = def.rowFromEntry(entry);
      if (existing === undefined) {
        await client.append(def.tab, row);
      } else {
        await client.updateRow(def.tab, existing.rowIndex, row);
      }
    },
    async append(entry) {
      await client.append(def.tab, def.rowFromEntry(entry));
    },
    async removeByKey(key) {
      const indexed = await listIndexed();
      const existing = indexed.find((r) =>
        def.keysEqual(def.keyOf(r.entry), key),
      );
      if (existing === undefined) return false;
      await client.deleteRow(def.tab, existing.rowIndex);
      return true;
    },
  };
}
