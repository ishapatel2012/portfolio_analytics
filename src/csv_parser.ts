import fs from "fs";
import csv from "csv-parser";
import { Readable } from "stream";

export interface TradeRow {
  "Order ID": string;
  Currency: string;
  Side: string;
  "Total Quantity": string;
  "Price Per Unit": string;
  "Total Amount": string;
  "TDS Amount": string;
  Status: string;
  "Created At": string;
  "Updated At": string;
}

interface FIFOResult {
  totalProfit: number;
  tax: number;
  netProfit: number;
  cashReceived: number;
}

// Overloaded function signatures
export function readCsv(path: string): Promise<TradeRow[]>;
export function readCsv(buffer: Buffer): Promise<TradeRow[]>;

// Implementation
export function readCsv(pathOrBuffer: string | Buffer): Promise<TradeRow[]> {
  return new Promise((resolve, reject) => {
    const results: TradeRow[] = [];

    let stream: Readable;

    if (Buffer.isBuffer(pathOrBuffer)) {
      // Create a readable stream from the buffer
      stream = Readable.from(pathOrBuffer);
    } else {
      // Create a read stream from the file path
      stream = fs.createReadStream(pathOrBuffer);
    }

    stream
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

// const data = await readCsv("/home/neosoft/Downloads/Insta_history.csv");

export function calculateFIFO(
  rows: TradeRow[],
  sellQty: number,
  sellPrice: number,
  taxRate = 0.3
): FIFOResult {
  // 1. Filter BTC buy rows
  const btcBuys = rows
    .filter(
      (r) => r.Currency === "BTC" && r.Side.toLowerCase() === "buy"
      // &&
      // r.Status.toLowerCase() === "filled"
    )
    .map((r) => ({
      qty: Number(r["Total Quantity"]),
      price: Number(r["Price Per Unit"]),
      date: new Date(r["Created At"]).getTime(),
    }));

  if (btcBuys.length === 0) {
    throw new Error("No BTC buy records found.");
  }

  // 2. Sort FIFO (oldest first)
  btcBuys.sort((a, b) => a.date - b.date);

  let remainingSell = sellQty;
  let totalProfit = 0;

  // 3. Consume lots FIFO
  for (const lot of btcBuys) {
    if (remainingSell <= 0) break;

    const take = Math.min(remainingSell, lot.qty);
    remainingSell -= take;
    const lotProfit = take * (sellPrice - lot.price);
    totalProfit += lotProfit;
  }

  if (remainingSell > 0) {
    throw new Error("Not enough BTC in buy history to cover sell quantity.");
  }

  // 4. Tax & net amounts
  const tax = totalProfit * taxRate;
  const netProfit = totalProfit - tax;

  const cashReceived = sellQty * sellPrice - tax;

  return {
    totalProfit,
    tax,
    netProfit,
    cashReceived,
  };
}

interface CoinTaxResult {
  symbol: string;
  totalSold: number;
  totalProfit: number;
  tax: number;
  netProfit: number;
  payableTax: number;
  remainingQty?: number;
  price?: number;
  createdAt: number;
}

export function calculateFifoForAllSymbols(
  rows: TradeRow[],
  taxRate = 0.3
): CoinTaxResult[] {
  // Group trades by symbol
  const coins = new Map<string, TradeRow[]>();

  console.log("ROWS", rows);
  for (const row of rows) {
    console.log(rows, "&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    const symbol = row.Currency;
    if (!coins.has(symbol)) coins.set(symbol, []);
    coins.get(symbol)!.push(row);
  }

  const results: CoinTaxResult[] = [];

  for (const [symbol, trades] of coins) {
    // Filter buys and sells
    const buys = trades
      .filter(
        (t) => t.Side.toLowerCase() === "buy"
        // && t.Status === "filled"
      )
      .map((t) => ({
        qty: Number(t["Total Quantity"]),
        price: Number(t["Price Per Unit"]),
        date: new Date(t["Created At"]).getTime(),
      }));

    const sells = trades
      .filter(
        (t) => t.Side.toLowerCase() === "sell"
        // && t.Status === "filled"
      )
      .map((t) => ({
        qty: Number(t["Total Quantity"]),
        price: Number(t["Price Per Unit"]),
        date: new Date(t["Created At"]).getTime(),
        tds: Number(t["TDS Amount"]),
      }));

    // if (sells.length === 0) continue; // No tax needed

    // Sort buys & sells by date
    if (buys.length > 0) buys.sort((a, b) => a.date - b.date);

    console.log(buys, "%%%%%%%%%%%%%%%%%%%");

    if (sells.length > 0) sells.sort((a, b) => a.date - b.date);

    console.log(sells, "%%%%%%%%%%%%%%%%%%%");

    let totalProfit = 0;
    let totalSold = 0;

    let tds = 0;

    let createdAt = 0;
    // FIFO Engine
    for (const sell of sells) {
      let remainingSell = sell.qty;
      totalSold += sell.qty;

      for (const buy of buys) {
        if (remainingSell <= 0) break;

        if (buy.qty === 0) continue;

        const take = Math.min(remainingSell, buy.qty);
        remainingSell -= take;
        buy.qty -= take;

        const profit = take * (sell.price - buy.price);
        totalProfit += profit;
      }

      tds = sell.tds;

      createdAt = sell.date;
    }

    //remaining quantity:
    const remainingQty = buys.reduce((s, b) => s + b.qty, 0);
    // const remainingQty = buys.reduce((s, b) => s + b.qty, 0);

    let tax = 0;
    let netProfit = 0;
    let tdsDeductionTax = 0;
    console.log("totalProfit", totalProfit);
    if (totalProfit > 0) {
      tax = totalProfit * taxRate;

      tax = tax * 0.04 + tax;
      netProfit = totalProfit - tax;
      tdsDeductionTax = tax - tds;
    }

    // if (totalSold === 0) {
    results.push({
      symbol,
      totalSold,
      totalProfit,
      tax,
      netProfit,
      payableTax: tdsDeductionTax,
      remainingQty,
      createdAt,
    });
    // }
  }

  return results;
}

export interface TradeRowUnifiedBinance {
  "Created At": Date;
  Currency: string;
  Side: string;
  "Price Per Unit": any;
  "Total Quantity": any;
  "Total Amount": any;
}

// Overloaded function signatures
export function readCsvBinance(path: string): Promise<TradeRowUnifiedBinance[]>;
export function readCsvBinance(
  buffer: Buffer
): Promise<TradeRowUnifiedBinance[]>;

// Implementation
export function readCsvBinance(
  pathOrBuffer: string | Buffer
): Promise<TradeRowUnifiedBinance[]> {
  return new Promise((resolve, reject) => {
    const results: TradeRowUnifiedBinance[] = [];

    let stream: Readable;

    if (Buffer.isBuffer(pathOrBuffer)) {
      // Create a readable stream from the buffer
      stream = Readable.from(pathOrBuffer);
    } else {
      // Create a read stream from the file path
      stream = fs.createReadStream(pathOrBuffer);
    }

    stream
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}
const isValidNumber = (v: unknown): v is number => {
  console.log(typeof v === "number" && Number.isFinite(v));
  return typeof v === "number" && Number.isFinite(v);
};

export function calculateFifoUnifiedBinance(
  rows: TradeRowUnifiedBinance[],
  taxRate = 0.3
) {
  // : CoinTaxResult[]
  // Group trades by symbol
  const coins = new Map<string, TradeRowUnifiedBinance[]>();

  console.log(rows);

  for (const row of rows) {
    const symbol = row.Currency;
    if (!coins.has(symbol)) coins.set(symbol, []);
    coins.get(symbol)!.push(row);
  }

  const results: CoinTaxResult[] = [];

  for (const [symbol, trades] of coins) {
    // Filter buys and sells
    const buys = trades
      .filter(
        (t) =>
          t.Side.toLowerCase() === "buy" &&
          t["Price Per Unit"] !== "No Data Available." &&
          t["Total Amount"] !== " NaN" &&
          t["Total Amount"] !== "Spot" &&
          t["Total Quantity"] !== "NaN"

        // isValidNumber(t["Price Per Unit"]) &&
        // isValidNumber(t["Total Quantity"]) &&
        // isValidNumber(t["Total Amount"])

        // && t.Status === "filled"
      )
      .map((t) => ({
        qty: Number(t["Total Quantity"]),
        price: Number(t["Price Per Unit"]),
        date: new Date(t["Created At"]).getTime(),
      }));

    const sells = trades
      .filter(
        (t) =>
          t.Side.toLowerCase() === "sell" &&
          t["Price Per Unit"] !== "No Data Available." &&
          t["Total Amount"] !== " NaN" &&
          t["Total Amount"] !== "Spot" &&
          t["Total Quantity"] !== "NaN"
      )
      .map((t) => ({
        qty: Number(t["Total Quantity"]),
        price: t["Price Per Unit"],
        date: new Date(t["Created At"]).getTime(),
        // tds: Number(t["TDS Amount"]),
      }));

    // if (sells.length === 0) continue; // No tax needed

    // Sort buys & sells by date
    buys.sort((a, b) => a.date - b.date);

    sells.sort((a, b) => a.date - b.date);

    let totalProfit = 0;
    let totalSold: number = 0;

    let tds = 0;

    let createdAt = 0;
    // FIFO Engine
    for (const sell of sells) {
      console.log(sell);
      let remainingSell = sell.qty;
      totalSold += sell.qty;

      console.log("totalSold", totalSold);

      for (const buy of buys) {
        if (remainingSell <= 0) break;

        if (buy.qty === 0) continue;

        const take = Math.min(remainingSell, buy.qty);
        remainingSell -= take;
        buy.qty -= take;

        const profit = take * (sell.price - buy.price);
        totalProfit += profit;
      }

      // tds = sell.tds;

      createdAt = sell.date;
    }

    //remaining quantity:
    const remainingQty = buys.reduce((s, b) => s + b.qty, 0);
    // const remainingQty = buys.reduce((s, b) => s + b.qty, 0);

    let tax = 0;
    let netProfit = 0;
    let tdsDeductionTax = 0;
    if (totalProfit > 0) {
      tax = totalProfit * taxRate;

      tax = tax * 0.04 + tax;
      netProfit = totalProfit - tax;
      // tdsDeductionTax = tax - tds;
    }

    // if (totalSold === 0) {
    results.push({
      symbol,
      totalSold,
      totalProfit,
      tax,
      netProfit,
      // normal payable tax right now without tds.
      payableTax: tax,
      remainingQty,
      createdAt,
    });
    // }

    // console.log(results);
    // break;
  }

  return results;
}
