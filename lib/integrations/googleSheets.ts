/* lib/integrations/googleSheets.ts */
import { google } from "googleapis";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getPrivateKey() {
  // В Vercel ключ часто хранится как строка с \n
  return mustEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export function getSpreadsheetConfig() {
  return {
    spreadsheetId: mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
    tab: process.env.GOOGLE_SHEETS_TAB || "Учёт",
  };
}

function parseRowNumber(updatedRange?: string | null): number | null {
  // Пример: "Учёт!A12:F12"
  if (!updatedRange) return null;
  const m = updatedRange.match(/![A-Z]+(\d+):/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: mustEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function isLikelyRequestNumber(v: string) {
  // В твоём проекте номера генерятся как PR-YYYYMMDD-XXXX
  return /^PR-/i.test(v);
}

async function getSheetIdByTitle(spreadsheetId: string, tab: string) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });

  const found = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = found?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Google Sheets tab not found: "${tab}"`);
  }

  return sheetId;
}

/** append в самый низ (как у тебя и было) */
export async function appendAccountingRow(values: (string | number)[]) {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });

  const updatedRange = res.data.updates?.updatedRange ?? null;
  const rowNumber = parseRowNumber(updatedRange);

  return { updatedRange, rowNumber };
}

/** читает колонку A (как у тебя и было) */
export async function getExistingRequestNumbersSet() {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:A`,
  });

  const rows = res.data.values ?? [];
  const set = new Set<string>();

  for (const r of rows) {
    const v = norm(r?.[0]);
    if (v) set.add(v);
  }

  return set;
}

/**
 * Мапа request_number -> { rowNumber, values[0..5] }
 * Читает A:F и находит строки по колонке A.
 */
export async function getSheetRequestRowMap() {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:F`,
  });

  const rows = res.data.values ?? [];
  const map = new Map<string, { rowNumber: number; values: string[] }>();

  // rows[0] обычно заголовки, но мы просто фильтруем по формату PR-
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rn = norm(row[0]);
    if (!rn) continue;
    if (!isLikelyRequestNumber(rn)) continue;

    const values = [norm(row[0]), norm(row[1]), norm(row[2]), norm(row[3]), norm(row[4]), norm(row[5])];

    map.set(rn, { rowNumber: i + 1, values });
  }

  return map;
}

/** Обновить конкретную строку A:F по номеру строки */
export async function updateAccountingRow(rowNumber: number, values: (string | number)[]) {
  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return { rowNumber };
}

/**
 * Удалить строки по номерам (1-based).
 * Важно: удаляем снизу вверх.
 */
export async function deleteAccountingRows(rowNumbers: number[]) {
  const nums = Array.from(new Set(rowNumbers))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);

  if (nums.length === 0) return { deleted: 0 };

  const sheets = getSheetsClient();
  const { spreadsheetId, tab } = getSpreadsheetConfig();
  const sheetId = await getSheetIdByTitle(spreadsheetId, tab);

  const requests = nums.map((n) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: n - 1, // 0-based inclusive
        endIndex: n, // exclusive
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return { deleted: nums.length };
}

/* ------------------------------------------------------------------ */
/* ✅ НОВОЕ: удобные функции "как при создании" для update/delete       */
/* ------------------------------------------------------------------ */

/**
 * Найти строку в Sheets по request_number (колонка A).
 * Возвращает rowNumber (1-based) или null если не найдено.
 */
export async function findRowNumberByRequestNumber(requestNumber: string) {
  const rn = norm(requestNumber);
  if (!rn) return null;

  const map = await getSheetRequestRowMap();
  const found = map.get(rn);
  return found?.rowNumber ?? null;
}

/**
 * ✅ UPSERT по номеру заявки:
 * - если строка с таким request_number есть — UPDATE A:F
 * - если нет — APPEND в конец
 *
 * Возвращает { action, rowNumber }
 */
export async function upsertRequestRowByNumber(valuesAtoF: (string | number)[]) {
  const rn = norm(valuesAtoF?.[0]);
  if (!rn) throw new Error("Missing request_number in values[0]");

  // читаем map A:F и ищем строку
  const map = await getSheetRequestRowMap();
  const found = map.get(rn);

  if (found) {
    await updateAccountingRow(found.rowNumber, valuesAtoF);
    return { action: "updated" as const, rowNumber: found.rowNumber };
  }

  const res = await appendAccountingRow(valuesAtoF);
  return { action: "inserted" as const, rowNumber: res.rowNumber ?? null };
}

/**
 * ✅ DELETE по номеру заявки:
 * - находит строку по request_number в колонке A
 * - удаляет строку (если найдена)
 */
export async function deleteRequestRowByNumber(requestNumber: string) {
  const rowNumber = await findRowNumberByRequestNumber(requestNumber);
  if (!rowNumber) return { ok: true, deleted: 0, rowNumber: null as number | null };

  const res = await deleteAccountingRows([rowNumber]);
  return { ok: true, deleted: res.deleted, rowNumber };
}
