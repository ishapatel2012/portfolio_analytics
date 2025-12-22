// unifyCoinDCXTrades.ts
import * as XLSX from "xlsx";
import {
  INCOMING_OPERATIONS,
  OUTGOING_OPERATIONS,
  type binanceUnifiedTrade,
  type TradeSide,
  type UnifiedTrade,
} from "./types/unified_trade.js";
import { pool } from "./db/db.js";

function extractAssetFromPair(pair: string, baseCurrency: string): string {
  if (!pair || !baseCurrency) return pair;

  if (pair.endsWith(baseCurrency)) {
    return pair.slice(0, pair.length - baseCurrency.length);
  }

  return pair;
}

export function unifyCoinDCXTrades(fileBuffer: Buffer): UnifiedTrade[] {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  const instantSheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes("instant")
  );

  const unified: UnifiedTrade[] = [];

  if (!instantSheetName) {
    throw new Error("Instant sheet not found");
  }

  const instantSheet = workbook.Sheets[instantSheetName];

  if (instantSheet) {
    const rows = XLSX.utils.sheet_to_json<any>(instantSheet, {
      range: 8,
      defval: null,
      raw: false,
    });

    for (const r of rows) {
      unified.push({
        "Order ID": String(r["Trade ID"]),
        "Created At": String(r["Trade Completion time"]),
        Currency: String(r["Crypto"]),
        Side: r["Side (Buy/Sell)"],
        "Price Per Unit": Number(r["Avg Buying/Selling Price(in INR)"]),
        // price_inr: Number(r["Avg Buying/Selling Price(in INR)"]),
        "Total Quantity": Number(r["Quantity"]),
        "Total Amount": Number(
          r["Gross Amount Paid/Received by the user(in INR)"]
        ),
        fee_inr: Number(r["Fees(in INR)"] || 0),
        net_inr: Number(r["Net Amount Paid/Received by the user(in INR)"]),
        "TDS Amount": Number(r["*TDS(in INR)"] || 0),
        source: "INSTANT",
      });
    }
  }

  /* ---------------- SPOT ORDER ---------------- */
  const spotSheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes("spot")
  );

  if (spotSheetName) {
    const spotSheet = workbook.Sheets[spotSheetName];

    if (spotSheet) {
      const rows = XLSX.utils.sheet_to_json<any>(spotSheet, {
        range: 8,
        defval: null,
        raw: false,
      });

      for (const r of rows) {
        const asset = extractAssetFromPair(
          r["Crypto Pair"],
          r["Base currency"]
        );

        unified.push({
          "Order ID": String(r["Trade ID"]),
          "Created At": String(r["Trade Completion time"]),
          Currency: asset,
          Side: r["Side (Buy/Sell)"],
          "Total Quantity": Number(r["Quantity"]),
          "Price Per Unit": Number(
            r["Avg Buying/Selling Price(in base currency)"]
          ),
          "Total Amount": Number(
            r["Gross Amount Paid/Received by the user(in base currency)"]
          ),
          fee_inr: Number(r["Fees(in base currency)"] || 0), // optional conversion later
          net_inr: Number(r["*Net Amount Paid/Received by the user (in INR)"]),
          "TDS Amount": Number(r["**TDS (in INR)"] || 0),
          source: "SPOT",
        });
      }
    }
  }

  return unified;
}

function extractAsset(pair: string): string {
  return pair.replace(/INR$/, "");
}

function extractPrice(value: string): number {
  return Number(
    value
      .replace(/INR/i, "") // remove INR
      .replace(/,/g, "") // remove thousand separators
      .trim()
  );
}

//remaining.
export function unifiedCoinSwitch(fileBuffer: Buffer): UnifiedTrade[] {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes("spot")
  );

  const unified: UnifiedTrade[] = [];

  if (!sheetName) {
    throw new Error("Instant sheet not found");
  }

  const spotTradesSheet = workbook.Sheets[sheetName];

  if (spotTradesSheet) {
    const rows = XLSX.utils.sheet_to_json<any>(spotTradesSheet, {
      range: 17,
      defval: null,
      raw: false,
    });

    for (const r of rows) {
      let currency = String(r["Market"]);

      currency = extractAsset(currency);

      let price = extractPrice(r["Price"]);

      unified.push({
        "Order ID": String(r["Transaction Id"]),
        "Created At": String(r["Date"]),
        "TDS Amount": Number(r["TDS Amount"] || 0),
        Side: r["Trade Type"] === "BUY" ? "BUY" : "SELL",

        Currency: currency,
        "Price Per Unit": price,
        // price_inr: Number(r["Avg Buying/Selling Price(in INR)"]),
        "Total Quantity": r["Volume"],
        "Total Amount": r["Total"],
        fee_inr: Number(r["Fees(in INR)"] || 0),
        net_inr: Number(r["Net Amount Paid/Received by the user(in INR)"]),
        source: "INSTANT",
      });
    }
  }

  console.log(unified, "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");

  return unified;
}

export function classifyOperation(operation: string): TradeSide {
  if (INCOMING_OPERATIONS.has(operation)) return "BUY";
  if (OUTGOING_OPERATIONS.has(operation)) return "SELL";

  return "BUY";
  // return null; // unknown / ignore
}

export function unifiedBinanceSheet(rows: { operation: string }[]) {
  return rows
    .map((row) => ({
      ...row,
      side: classifyOperation(row.operation),
    }))
    .filter((row) => row.side !== null);
}

const row = {
  operation: "Transaction Sold",
  asset: "SOL",
  amount: 0.05,
};

const side = classifyOperation(row.operation);

console.log(side); // BUY

async function getBuyingPrice(date: Date, symbol: string) {
  const slug = await getSlugName(symbol);

  console.log("###", slug);
  console.log(date, "***********************");

  const query_table = `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = '${slug}'
  )`;

  const result = await pool.query(query_table);

  const tableExists = result.rows[0].exists;

  if (tableExists) {
    const query = `
    SELECT
      COALESCE(price, close) AS price,
      time_interval
    FROM public.${slug}
    WHERE time_interval::date = DATE '${date}'
    ORDER BY ABS(
      EXTRACT(EPOCH FROM (time_interval - TIMESTAMPTZ '${date}'))
    )
    LIMIT 1;
  `;

    const { rows } = await pool.query(query);
    console.log(rows, "$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

    return rows[0]?.price;
  } else {
    return "No Data Available.";
  }
}

export interface CryptoMaster {
  slug: string;
  symbol: string;
}

export async function getSlugName(symbol: string): Promise<string | undefined> {
  console.log(symbol);
  const query = `
    SELECT slug, symbol
    FROM public._crypto_master WHERE symbol='${symbol}'
    AND is_active=true AND live_crypto=true
  `;

  console.log(query);

  const { rows } = await pool.query<CryptoMaster>(query);

  return rows[0]?.slug;
}

// export async function unifiedBinanceTrades(
//   fileBuffer: Buffer
// ): Promise<binanceUnifiedTrade[]> {
//   const workbook = XLSX.read(fileBuffer, { type: "buffer" });

//   const sheetName = workbook.SheetNames[0];

//   const unified: binanceUnifiedTrade[] = [];

//   if (!sheetName) {
//     throw new Error("Instant sheet not found");
//   }

//   const sheet = workbook.Sheets[sheetName];

//   if (sheet) {
//     const rows = XLSX.utils.sheet_to_json<any>(sheet, {
//       defval: null,
//       raw: false,
//     });

//     for (const r of rows) {
//       let side = classifyOperation(r["Operation"]);
//       let price = await getBuyingPrice(new Date(r["UTC_Time"]), r["Coin"]);
//       //@ts-ignore

//       // get the buying price and selling price based on the date.
//       // let totalAmount = await getBuyingPrice(
//       //   new Date(r["UTC_Time"]),
//       //   symbol[0].slug
//       // );

//       // console.log(totalAmount);
//       console.log(r["Change"]);

//       unified.push({
//         "Created At": String(r["UTC_Time"]),
//         Currency: String(r["Coin"]),
//         Side: side,
//         "Price Per Unit": price,
//         "Total Quantity": Math.abs(r["Change"]),
//         "Total Amount": Math.abs(r["Change"] * price),
//         source: String(r["Account"]),
//       });
//     }
//   }

//   return unified;
// }

export async function unifiedBinanceTrades(
  fileBuffer: Buffer
): Promise<binanceUnifiedTrade[]> {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Sheet not found");
  }

  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("Sheet not found");
  }

  const rows = XLSX.utils.sheet_to_json<any>(sheet, {
    defval: null, // IMPORTANT: prevents missing keys
    raw: false,
  });

  const unified: binanceUnifiedTrade[] = [];

  for (const r of rows) {
    const side = classifyOperation(r["Operation"]);

    // --- DATE NORMALIZATION ---
    const createdAt = r["UTC_Time"];

    // --- PRICE ---
    const price = await getBuyingPrice(createdAt, r["Coin"]);

    // --- QUANTITY ---
    const changeRaw = Number(r["Change"]);
    const quantity = Math.abs(changeRaw);

    // --- TOTAL AMOUNT ---
    const totalAmount = quantity * price;

    // --- PUSH WITH FULL, FIXED SHAPE ---
    unified.push({
      "Created At": createdAt,
      Currency: String(r["Coin"] ?? ""),
      Side: side,
      "Price Per Unit": price,
      "Total Quantity": quantity, // ALWAYS NUMBER
      "Total Amount": totalAmount, // ALWAYS NUMBER
      source: String(r["Account"] ?? ""),
    });
  }

  return unified;
}
