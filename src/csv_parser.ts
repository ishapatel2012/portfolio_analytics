import fs from "fs";
import csv from "csv-parser";

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

export function readCsv(path: string): Promise<TradeRow[]> {
  return new Promise((resolve, reject) => {
    const results: TradeRow[] = [];

    fs.createReadStream(path)
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
      (r) =>
        r.Currency === "BTC" &&
        r.Side.toLowerCase() === "buy" &&
        r.Status.toLowerCase() === "filled"
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

  for (const row of rows) {
    const symbol = row.Currency;
    if (!coins.has(symbol)) coins.set(symbol, []);
    coins.get(symbol)!.push(row);
  }

  const results: CoinTaxResult[] = [];

  for (const [symbol, trades] of coins) {
    // Filter buys and sells
    const buys = trades
      .filter((t) => t.Side === "buy" && t.Status === "filled")
      .map((t) => ({
        qty: Number(t["Total Quantity"]),
        price: Number(t["Price Per Unit"]),
        date: new Date(t["Created At"]).getTime(),
      }));

    const sells = trades
      .filter((t) => t.Side === "sell" && t.Status === "filled")
      .map((t) => ({
        qty: Number(t["Total Quantity"]),
        price: Number(t["Price Per Unit"]),
        date: new Date(t["Created At"]).getTime(),
        tds: Number(t["TDS Amount"]),
      }));

    // if (sells.length === 0) continue; // No tax needed

    // Sort buys & sells by date
    buys.sort((a, b) => a.date - b.date);

    sells.sort((a, b) => a.date - b.date);

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

    let tax = totalProfit * taxRate;

    tax = tax * 0.04 + tax;
    const tdsDeductionTax = tax - tds;

    const netProfit = totalProfit - tax;

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
