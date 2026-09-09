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

export function getSpreadsheetConfig(customTabName?: string | null) {
  return {
    spreadsheetId: mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
    tab: customTabName || process.env.GOOGLE_SHEETS_TAB || "Учёт",
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

    return norm(value);
  });
}

function isLikelyRequestNumber(value: string) {
  return /^(PR|GA|[A-Z]{2,4})-/i.test(norm(value));
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
 * Append строки заявки в конец A:G (7 столбцов).
 * @param customTabName Имя листа из настроек проекта (опционально)
 */
export async function appendAccountingRow(values: AccountingRowValue[], customTabName?: string | null) {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig(customTabName);

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
export async function getExistingRequestNumbersSet(customTabName?: string | null) {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig(customTabName);

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
export async function getSheetRequestRowMap(customTabName?: string | null) {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig(customTabName);

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
export async function updateAccountingRow(rowNumber: number, values: AccountingRowValue[], customTabName?: string | null) {
  if (!Number.isFinite(rowNumber) || rowNumber <= 0) {
    throw new Error(`Invalid row number: ${rowNumber}`);
  }

  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig(customTabName);

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
export async function deleteAccountingRows(rowNumbers: number[], customTabName?: string | null) {
  const nums = Array.from(new Set(rowNumbers))
    .filter((rowNumber) => Number.isFinite(rowNumber) && rowNumber > 0)
    .sort((a, b) => b - a);

  if (!nums.length) {
    return { deleted: 0 };
  }

  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig(customTabName);
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
export async function findRowNumberByRequestNumber(requestNumber: string, customTabName?: string | null) {
  const normalized = norm(requestNumber);
  if (!normalized) return null;

  const map = await getSheetRequestRowMap(customTabName);
  const found = map.get(normalized);

  return found?.rowNumber ?? null;
}

/**
 * UPSERT строки A:G по request_number из колонки A.
 */
export async function upsertRequestRowByNumber(valuesAtoG: AccountingRowValue[], customTabName?: string | null) {
  const requestNumber = norm(valuesAtoG?.[0]);

  if (!requestNumber) {
    throw new Error("Missing request_number in values[0]");
  }

  const map = await getSheetRequestRowMap(customTabName);
  const found = map.get(requestNumber);

  if (found) {
    await updateAccountingRow(found.rowNumber, valuesAtoG, customTabName);

    return {
      action: "updated" as const,
      rowNumber: found.rowNumber,
    };
  }

  const appended = await appendAccountingRow(valuesAtoG, customTabName);

  return {
    action: "inserted" as const,
    rowNumber: appended.rowNumber ?? null,
  };
}

/**
 * DELETE строки из Google Sheets по request_number.
 */
export async function deleteRequestRowByNumber(requestNumber: string, customTabName?: string | null) {
  const rowNumber = await findRowNumberByRequestNumber(requestNumber, customTabName);

  if (!rowNumber) {
    return {
      ok: true,
      deleted: 0,
      rowNumber: null as number | null,
    };
  }

  const deleted = await deleteAccountingRows([rowNumber], customTabName);

  return {
    ok: true,
    deleted: deleted.deleted,
    rowNumber,
  };
}

// ----------------------------------------------------------------------------
// Точечное обновление ячеек листа «Учёт» после оплаты (статус + колонка H)
// ----------------------------------------------------------------------------

const ACCOUNTING_STATUS_COLUMN = "G";
const ACCOUNTING_PAYMENT_COLUMN = "H";

/**
 * Обновляет одну ячейку строки на листе «Учёт».
 * @returns { updatedRange, rowNumber }
 */
async function updateAccountingCellValue(
  rowNumber: number,
  column: string,
  value: string | number,
  customTabName?: string | null,
) {
  if (!Number.isFinite(rowNumber) || rowNumber <= 0) {
    throw new Error(`Invalid row number: ${rowNumber}`);
  }

  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig(customTabName);

  const res = await sheets.spreadsheets.values.update(
    {
      spreadsheetId,
      range: range(tab, `${column}${rowNumber}`),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[value]],
      },
    },
    {
      timeout: GOOGLE_API_TIMEOUT_MS,
    },
  );

  return {
    updatedRange: res.data.updatedRange ?? null,
    rowNumber,
  };
}

/**
 * Меняет статус заявки в колонке G листа «Учёт» (например «⏳ Ожидает» →
 * «✅ Оплачено» после подтверждения оплаты из вебхука Продамуса).
 *
 * @param rowNumber 1-based номер строки в таблице (поле purchase_requests.sheet_row)
 * @param status Новое значение статуса («✅ Оплачено», «Одобрено» и т.п.)
 */
export async function updateGoogleSheetRequestStatus(
  rowNumber: number,
  status: string,
  customTabName?: string | null,
) {
  const cleanStatus = String(status ?? "").trim();
  if (!cleanStatus) {
    return { updatedRange: null as string | null, rowNumber };
  }

  return updateAccountingCellValue(
    rowNumber,
    ACCOUNTING_STATUS_COLUMN,
    cleanStatus,
    customTabName,
  );
}

/**
 * Записывает в колонку H листа «Учёт» итоговую сумму платежа с детализацией
 * комиссии Продамуса. Колонка H — 8-я по счёту.
 *
 * @param rowNumber 1-based номер строки в таблице
 * @param paymentValue Строка вида
 *   "50 ₽ (комиссия 0.6 ₽, к выплате 49.40 ₽)" — для наглядного учёта,
 *   либо число (сумма к получению) — если колонка H в таблице числовая.
 */
export async function updateAccountingPaymentColumn(
  rowNumber: number,
  paymentValue: string | number,
  customTabName?: string | null,
) {
  const cleanValue =
    typeof paymentValue === "number" && Number.isFinite(paymentValue)
      ? paymentValue
      : String(paymentValue ?? "").trim();

  if (cleanValue === "") {
    return { updatedRange: null as string | null, rowNumber };
  }

  return updateAccountingCellValue(
    rowNumber,
    ACCOUNTING_PAYMENT_COLUMN,
    cleanValue,
    customTabName,
  );
}

// ----------------------------------------------------------------------------
// Prodamus: успешные оплаты на отдельном листе
// ----------------------------------------------------------------------------

const PRODAMUS_COLUMNS = "A:E";
const PRODAMUS_COLUMNS_COUNT = 5;

export type ProdamusPaymentRecord = {
  /** ФИО покупателя (из purchase_requests.full_name). */
  fullName: string;
  /** Email покупателя. */
  email: string;
  /** Сумма оплаты (purchase_requests.total_price). */
  totalPrice: number;
  /** Дата оплаты в ISO. */
  paidAt: string;
  /** Названия оплаченных материалов. */
  materialTitles: string[];
};

function formatDateRU(value: string | number | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function normalizeProdamusValues(record: ProdamusPaymentRecord) {
  const materialTitles = (Array.isArray(record.materialTitles) ? record.materialTitles : [])
    .map((title) => norm(title))
    .filter(Boolean);

  const row = [
    norm(record.fullName) || "—",
    norm(record.email),
    Number(record.totalPrice) || 0,
    record.paidAt ? formatDateRU(record.paidAt) : formatDateRU(new Date()),
    materialTitles.join(", ") || "—",
  ];

  return Array.from({ length: PRODAMUS_COLUMNS_COUNT }, (_, index) => row[index] ?? "");
}

/**
 * Записать данные об успешной оплате Продамуса на отдельный лист.
 *
 * Структура строки (A:E): ФИО, email, сумма, дата, перечень материалов.
 * Имя листа берётся из GOOGLE_SHEETS_PRODAMUS_TAB.
 *
 * @param record Данные оплаты
 * @param customTabName Опциональное переопределение имени листа
 */
export async function logProdamusPayment(
  record: ProdamusPaymentRecord,
  customTabName?: string | null,
) {
  const sheets = getSheetsClient();
  const spreadsheetId = mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
  const tab = customTabName || mustEnv("GOOGLE_SHEETS_PRODAMUS_TAB");

  const res = await sheets.spreadsheets.values.append(
    {
      spreadsheetId,
      range: range(tab, PRODAMUS_COLUMNS),
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [normalizeProdamusValues(record)],
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
