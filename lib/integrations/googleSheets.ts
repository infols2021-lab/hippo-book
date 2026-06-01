/* lib/integrations/googleSheets.ts */
import "server-only";

import { google } from "googleapis";

const ACCOUNTING_COLUMNS = "A:G";
const ACCOUNTING_LAST_COLUMN = "G";
const ACCOUNTING_COLUMNS_COUNT = 7;
const GOOGLE_API_TIMEOUT_MS = 15_000;

export type AccountingRowValue = string | number | null | undefined;

export type SheetRowInfo = {
  rowNumber: number;
  values: string[];
};

function mustEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

function norm(value: unknown) {
  return String(value ?? "").trim();
}

function getPrivateKey() {
  return mustEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
}

function quoteSheetName(tab: string) {
  const safe = String(tab || "Учёт").replace(/'/g, "''");
  return `'${safe}'`;
}

function range(tab: string, address: string) {
  return `${quoteSheetName(tab)}!${address}`;
}

export function getSpreadsheetConfig() {
  return {
    spreadsheetId: mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
    tab: process.env.GOOGLE_SHEETS_TAB || "Учёт",
  };
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: mustEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function parseRowNumber(updatedRange?: string | null): number | null {
  if (!updatedRange) return null;

  const match = updatedRange.match(/![A-Z]+(\d+):/);
  if (!match) return null;

  const rowNumber = Number(match[1]);
  return Number.isFinite(rowNumber) && rowNumber > 0 ? rowNumber : null;
}

function normalizeAccountingValues(values: AccountingRowValue[]) {
  return Array.from({ length: ACCOUNTING_COLUMNS_COUNT }, (_, index) => {
    const value = values[index];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    let clearedValue = norm(value);
    // Полностью убираем упоминание олимпиады и кубок из любых ячеек перед отправкой в таблицу
    clearedValue = clearedValue.replace(/🏆\s*Олимпиада/gi, "").replace(/Олимпиада/gi, "").trim();
    return clearedValue;
  });
}

function isLikelyRequestNumber(value: string) {
  return /^(PR|GA)-/i.test(norm(value));
}

async function getSheetIdByTitle(spreadsheetId: string, tab: string) {
  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get(
    {
      spreadsheetId,
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  const found = meta.data.sheets?.find((sheet) => sheet.properties?.title === tab);
  const sheetId = found?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Google Sheets tab not found: "${tab}"`);
  }

  return sheetId;
}

/**
 * Append строки заявки в конец A:G.
 */
export async function appendAccountingRow(values: AccountingRowValue[]) {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  const res = await sheets.spreadsheets.values.append(
    {
      spreadsheetId,
      range: range(tab, ACCOUNTING_COLUMNS),
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [normalizeAccountingValues(values)],
      },
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  const updatedRange = res.data.updates?.updatedRange ?? null;
  const rowNumber = parseRowNumber(updatedRange);

  return {
    updatedRange,
    rowNumber,
  };
}

/**
 * Читает колонку A и возвращает Set request_number.
 */
export async function getExistingRequestNumbersSet() {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  const res = await sheets.spreadsheets.values.get(
    {
      spreadsheetId,
      range: range(tab, "A:A"),
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  const rows = res.data.values ?? [];
  const set = new Set<string>();

  for (const row of rows) {
    const requestNumber = norm(row?.[0]);

    if (!requestNumber) continue;
    if (!isLikelyRequestNumber(requestNumber)) continue;

    set.add(requestNumber);
  }

  return set;
}

/**
 * Мапа request_number -> { rowNumber, values[0..6] }.
 * Читает A:G и учитывает только строки, где колонка A похожа на номер заявки.
 */
export async function getSheetRequestRowMap() {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  const res = await sheets.spreadsheets.values.get(
    {
      spreadsheetId,
      range: range(tab, ACCOUNTING_COLUMNS),
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  const rows = res.data.values ?? [];
  const map = new Map<string, SheetRowInfo>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const requestNumber = norm(row[0]);

    if (!requestNumber) continue;
    if (!isLikelyRequestNumber(requestNumber)) continue;

    const values = Array.from({ length: ACCOUNTING_COLUMNS_COUNT }, (_, valueIndex) => norm(row[valueIndex]));

    map.set(requestNumber, {
      rowNumber: index + 1,
      values,
    });
  }

  return map;
}

/**
 * Обновить конкретную строку A:G по номеру строки.
 */
export async function updateAccountingRow(rowNumber: number, values: AccountingRowValue[]) {
  if (!Number.isFinite(rowNumber) || rowNumber <= 0) {
    throw new Error(`Invalid row number: ${rowNumber}`);
  }

  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  await sheets.spreadsheets.values.update(
    {
      spreadsheetId,
      range: range(tab, `A${rowNumber}:${ACCOUNTING_LAST_COLUMN}${rowNumber}`),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [normalizeAccountingValues(values)],
      },
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  return { rowNumber };
}

/**
 * Удалить строки по номерам 1-based.
 * Важно: удаляем снизу вверх, иначе номера строк съедут.
 */
export async function deleteAccountingRows(rowNumbers: number[]) {
  const nums = Array.from(new Set(rowNumbers))
    .filter((rowNumber) => Number.isFinite(rowNumber) && rowNumber > 0)
    .sort((a, b) => b - a);

  if (!nums.length) {
    return { deleted: 0 };
  }

  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();
  const sheetId = await getSheetIdByTitle(spreadsheetId, tab);

  const requests = nums.map((rowNumber) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: rowNumber - 1,
        endIndex: rowNumber,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate(
    {
      spreadsheetId,
      requestBody: { requests },
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  return {
    deleted: nums.length,
  };
}

/**
 * Найти строку в Google Sheets по request_number.
 */
export async function findRowNumberByRequestNumber(requestNumber: string) {
  const normalized = norm(requestNumber);
  if (!normalized) return null;

  const map = await getSheetRequestRowMap();
  const found = map.get(normalized);

  return found?.rowNumber ?? null;
}

/**
 * UPSERT строки A:G по request_number из колонки A.
 */
export async function upsertRequestRowByNumber(valuesAtoG: AccountingRowValue[]) {
  const requestNumber = norm(valuesAtoG?.[0]);

  if (!requestNumber) {
    throw new Error("Missing request_number in values[0]");
  }

  const map = await getSheetRequestRowMap();
  const found = map.get(requestNumber);

  if (found) {
    await updateAccountingRow(found.rowNumber, valuesAtoG);

    return {
      action: "updated" as const,
      rowNumber: found.rowNumber,
    };
  }

  const appended = await appendAccountingRow(valuesAtoG);

  return {
    action: "inserted" as const,
    rowNumber: appended.rowNumber ?? null,
  };
}

/**
 * DELETE строки из Google Sheets по request_number.
 */
export async function deleteRequestRowByNumber(requestNumber: string) {
  const rowNumber = await findRowNumberByRequestNumber(requestNumber);

  if (!rowNumber) {
    return {
      ok: true,
      deleted: 0,
      rowNumber: null as number | null,
    };
  }

  const deleted = await deleteAccountingRows([rowNumber]);

  return {
    ok: true,
    deleted: deleted.deleted,
    rowNumber,
  };
}