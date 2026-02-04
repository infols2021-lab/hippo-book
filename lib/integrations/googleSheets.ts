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
    const v = String(r?.[0] ?? "").trim();
    if (v) set.add(v);
  }

  return set;
}
