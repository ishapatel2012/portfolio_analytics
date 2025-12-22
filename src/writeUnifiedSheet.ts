import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import type {
  binanceUnifiedTrade,
  UnifiedTrade,
} from "./types/unified_trade.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// export function saveUnifiedSheet(unified: UnifiedTrade[]): {
//   filePath: string;
//   fileName: string;
// } {
//   const workbook = XLSX.utils.book_new();
//   const sheet = XLSX.utils.json_to_sheet(unified);

//   XLSX.utils.book_append_sheet(workbook, sheet, "Unified_Trades_INR");

//   const fileName = `Unified_CoinDCX_Report_${Date.now()}.xlsx`;
//   const filePath = path.join(__dirname, "../Downloads", fileName);

//   fs.mkdirSync(path.dirname(filePath), { recursive: true });
//   XLSX.writeFile(workbook, filePath);

//   return { filePath, fileName };
// }

export function saveUnifiedCSV(unified: UnifiedTrade[]): {
  filePath: string;
  fileName: string;
} {
  if (unified.length === 0) {
    throw new Error("No unified data to write");
  }

  const headers = Object.keys(unified[0] as UnifiedTrade);

  const csvRows: string[] = [];
  csvRows.push(headers.join(",")); // header row

  for (const row of unified) {
    const values = headers.map((h) => {
      const val = (row as any)[h];

      if (val === null || val === undefined) return "";

      // Escape commas, quotes, newlines
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });

    csvRows.push(values.join(","));
  }

  const csvContent = csvRows.join("\n");

  const fileName = `Unified_CoinDCX_Report_${Date.now()}.csv`;
  const filePath = path.join(__dirname, "../uploads", fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csvContent, "utf8");

  return { filePath, fileName };
}

export function saveBinanceCSV(unified: binanceUnifiedTrade[]): {
  filePath: string;
  fileName: string;
} {
  if (unified.length === 0) {
    throw new Error("No unified data to write");
  }

  const headers = Object.keys(unified[0] as binanceUnifiedTrade);

  const csvRows: string[] = [];
  csvRows.push(headers.join(",")); // header row

  for (const row of unified) {
    const values = headers.map((h) => {
      const val = (row as any)[h];

      if (val === null || val === undefined) return "";

      // Escape commas, quotes, newlines
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });

    csvRows.push(values.join(","));
  }

  const csvContent = csvRows.join("\n");

  const fileName = `Unified_Binance_Report_${Date.now()}.csv`;
  const filePath = path.join(__dirname, "../uploads", fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csvContent, "utf8");

  return { filePath, fileName };
}
