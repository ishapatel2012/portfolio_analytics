import express, { json } from "express";
import axios from "axios";
import * as crypto from "crypto";
import dotenv from "dotenv";
import { Redis } from "ioredis";
import fs from "fs";
import path from "path";
import { detectOrigins } from "./assetOriginDetector.js";
import {
  calculateFIFO,
  calculateFifoForAllSymbols,
  readCsv,
} from "./csv_parser.js";
import { generateTaxPdf } from "./generate_pdf.js";

import { fileURLToPath } from "url";
import { exchangePairs } from "./exchangePais.js";
import { accountSymbols } from "./accountSymbols.js";
import { generateBinanceHoldingsPdf } from "./binance_pdf.js";
import { generateAssetSourcePdf } from "./binance_history_pdf.js";
import { classifyAssets } from "./binanceHistory.js";
import bodyParser from "body-parser";
import { upload } from "./upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const ORDERS_FILE = path.join(process.cwd(), "all_orders.json");

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT!) || 6379,
  //   password: process.env.REDIS_PASSWORD! || undefined,
});

// quick sanity check
redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err: any) => console.error("Redis error:", err));

const app = express();
const PORT = 5000;

app.set("redis", redis);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

import cors from "cors";
import { calculateTax } from "./binanceTaxCalculation.js";

app.use(
  cors({
    origin: [
      //   "http://localhost:5173", // Vite / React
      "http://localhost:3000", // optional
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// const API_KEY = process.env.BINANCE_API_KEY!;
// const API_SECRET = process.env.BINANCE_API_SECRET!;

// Utility to sign queries
function sign(query: string, API_SECRET: string) {
  return crypto.createHmac("sha256", API_SECRET).update(query).digest("hex");
}

const QUOTES = ["USDT", "USDC", "BTC", "ETH", "BNB"];

app.get("/", (req, res) => res.send("OK"));

app.post("/account", async (req, res) => {
  try {
    const { API_KEY, API_SECRET } = req.body;
    console.log(API_KEY, API_SECRET);

    const baseURL = "https://api.binance.com";
    const endpoint = "/api/v3/account";

    const timestamp = Date.now();
    const recvWindow = 60000; // optional but recommended

    const query = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = sign(query, API_SECRET);

    const url = `${baseURL}${endpoint}?${query}&signature=${signature}`;

    const response = await axios.get(url, {
      headers: {
        "X-MBX-APIKEY": API_KEY,
      },
    });

    generateBinanceHoldingsPdf(
      response.data.balances,
      "Binance_Holdings_Report.pdf"
    );

    res.json(response.data);
  } catch (err: any) {
    console.error(err?.response?.data || err);
    res
      .status(500)
      .json(err?.response?.data || { error: "Error fetching account info" });
  }
});

app.get("/all-orders", async (req, res) => {
  try {
    const { API_KEY, API_SECRET } = req.body;
    const symbol = "ZECUSDC"; // you bought ZEC using USDT
    // const symbol = "TRXUSDT";

    console.log(symbol);

    const baseURL = "https://api.binance.com";
    const endpoint = "/api/v3/allOrders";

    const timestamp = Date.now();
    const recvWindow = 60000;

    const query = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = sign(query, API_SECRET);

    const url = `${baseURL}${endpoint}?${query}&signature=${signature}`;

    const response = await axios.get(url, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });

    return res.json(response.data);
  } catch (err: any) {
    console.error(err?.response?.data || err);
    return res
      .status(500)
      .json(err?.response?.data || { error: "Error fetching orders" });
  }
});

app.post("/myTrades", async (req, res) => {
  try {
    const baseURL = "https://api.binance.com";
    const endpoint = "/api/v3/myTrades";

    const { API_KEY, API_SECRET } = req.body;

    const timestamp = Date.now();
    const recvWindow = 60000;
    const symbol = "TRXUSDT";

    // const query = `symbol=${symbol}&timestamp=${timestamp}`;
    const query = `timestamp=${timestamp}`;

    const signature = sign(query, API_SECRET);

    const url = `${baseURL}${endpoint}?${query}&signature=${signature}`;

    const response = await axios.get(url, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });

    return res.json(response.data);
  } catch (err: any) {
    console.error(err?.response?.data || err);
    return res
      .status(500)
      .json(err?.response?.data || { error: "Error fetching OCO order list" });
  }
});

async function getHeldAssets(API_KEY: string, API_SECRET: string) {
  try {
    const timestamp = Date.now();
    const recvWindow = 60000;

    const query = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = sign(query, API_SECRET);

    const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;

    const response = await axios.get(url, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });

    return (
      response.data.balances
        //@ts-ignore
        .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0)
        //@ts-ignore
        .map((b) => {
          return { asset: b.asset, free: b.free };
        })
    );
  } catch (err: any) {
    console.error(err?.response?.data || err);
    // return res
    //   .status(500)
    //   .json(err?.response?.data || { error: "Error fetching assets" });
  }
}

// console.log(
//   await getHeldAssets(
//     "i7iuOG8rNrRpne2oRCw7zGw9jbTvK7FLFNAtckngIsmO6hrT7pD4gIN1XnhmN5QC",
//     "tuPuFTfwsjwMT0O4yvUtydMRK7dDwi9hPAD5bsaJMyk9SlxGpO6G8aEOsURpM5wP"
//   )
// );

app.post("/get-assets", async (req, res) => {
  const { API_KEY, API_SECRET } = req.body;
  const assets = await getHeldAssets(API_KEY, API_SECRET);
  return res.json(assets);
});

app.get("/get-all-combinations", async (req, res) => {
  const allPairs = exchangePairs; // 3342
  const account = accountSymbols; // 145

  // Build one combined regex instead of looping 145 times
  // Example: /(BTC|ETH|LTC|BNB)/
  const pattern = new RegExp(account.join("|"));

  // Filter in one fast pass
  const result = allPairs.filter((pair) => pattern.test(pair));

  return res.json(result);
});

function getAllCombinations() {
  const allPairs = exchangePairs; // 3342
  const account = accountSymbols; // 145

  // Build one combined regex instead of looping 145 times
  // Example: /(BTC|ETH|LTC|BNB)/
  const pattern = new RegExp(account.join("|"));

  // Filter in one fast pass
  const result = allPairs.filter((pair) => pattern.test(pair));

  return result;
}

async function getTrades(symbol: string, API_KEY: string, API_SECRET: string) {
  const timestamp = Date.now();
  const recvWindow = 60000;

  const query = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = sign(query, API_SECRET);

  const url = `https://api.binance.com/api/v3/myTrades?${query}&signature=${signature}`;

  try {
    const response = await axios.get(url, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });
    return response.data;
  } catch {
    return [];
  }
}

app.get("/full-history", async (req, res) => {
  try {
    const { API_KEY, API_SECRET } = req.body;
    const client = req.app.get("redis");

    const result = await client.get("full-history");
    if (result) {
      return res.json(JSON.parse(result));
    }
    const assets = await getHeldAssets(API_KEY, API_SECRET);
    console.log(assets.length);
    let finalResults: any[] = [];

    //@ts-ignore
    for (const asset of assets) {
      for (const quote of QUOTES) {
        const symbol = `${asset}${quote}`;
        console.log(symbol);

        const trades = await getTrades(symbol, API_KEY, API_SECRET);

        if (trades.length > 0) {
          finalResults.push({
            asset,
            pair: symbol,
            quoteAsset: quote,
            trades,
          });
        }
      }
    }

    await client.set("full-history", JSON.stringify(finalResults));

    return res.json(finalResults);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch full history" });
  }
});

app.get("/formatted-history", async (req, res) => {
  try {
    // 1. Fetch complete trade history (your previously created function)
    // const fullHistory = await fetchFullTradeHistory();
    const fullHistory = await axios.get("http://localhost:5000/full-history");
    // fullHistory = [ { asset, pair, quoteAsset, trades: [...] }, ...]

    let formatted: any[] = [];

    // 2. Loop through each asset's trade data
    for (const item of fullHistory.data) {
      for (const trade of item.trades) {
        formatted.push({
          symbol: trade.symbol, // example: "ZECUSDT"
          price: trade.price, // string
          qty: trade.qty, // string
          quoteQty: trade.quoteQty, // string
          side: trade.isBuyer ? "BUY" : "SELL", // convert boolean → BUY/SELL
          time: trade.time, // timestamp
        });
      }
    }

    // Sort newest-first (optional)
    formatted.sort((a, b) => b.time - a.time);

    return res.json(formatted);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Formatting failed" });
  }
});

app.get("/exchange-info", async (req, res) => {
  try {
    const url = "https://api.binance.com/api/v3/exchangeInfo";

    const response = await axios.get(url);

    const symbols = response.data.symbols.map((s: any) => s.symbol);
    console.log(symbols.length);
    return res.json(symbols);
  } catch (err: any) {
    console.error(err?.response?.data || err);
    return res.status(500).json({
      error: "Failed to fetch exchangeInfo",
      details: err?.response?.data || err.message,
    });
  }
});

function appendOrdersToFile(symbol: string, orders: any[]) {
  let existing = [];

  // Load existing file (if exists)
  if (fs.existsSync(ORDERS_FILE)) {
    try {
      const content = fs.readFileSync(ORDERS_FILE, "utf-8");
      existing = JSON.parse(content);
    } catch {
      existing = [];
    }
  }

  // Append new data with symbol included
  const newEntries = orders.map((order) => ({
    symbol,
    ...order,
  }));

  const updated = [...existing, ...newEntries];

  fs.writeFileSync(ORDERS_FILE, JSON.stringify(updated, null, 2));
  console.log(`✔ Saved ${newEntries.length} orders for ${symbol}`);
}

async function getAllSymbols() {
  const url = "https://api.binance.com/api/v3/exchangeInfo";
  const res = await axios.get(url);
  return res.data.symbols.map((x: any) => x.symbol);
}

// async function getOrders(symbol: string) {
//   const timestamp = Date.now();
//   const recvWindow = 60000;

//   const query = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
//   const signature = sign(query);

//   const url = `https://api.binance.com/api/v3/allOrders?${query}&signature=${signature}`;

//   try {
//     const res = await axios.get(url, {
//       headers: { "X-MBX-APIKEY": API_KEY },
//     });

//     console.log(res.data);

//     return res.data;
//   } catch (err: any) {
//     // Most symbols will return: -2013 NO_SUCH_ORDER
//     return [];
//   }
// }

async function getOrders(symbol: string, API_KEY: string, API_SECRET: string) {
  const timestamp = Date.now();
  const recvWindow = 60000;

  const query = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = sign(query, API_SECRET);

  const url = `https://api.binance.com/api/v3/allOrders?${query}&signature=${signature}`;

  try {
    // IMPORTANT: add delay before hitting Binance
    sleep(400); // 400ms is safe
    console.log(`Fetching orders for ${symbol}...`);

    const res = await axios.get(url, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });

    if (Array.isArray(res.data) && res.data.length !== 0) {
      appendOrdersToFile(symbol, res.data);
    }

    return res.data;
  } catch (err: any) {
    const msg = err?.response?.data;

    // Binance rate-limit error
    if (msg?.code === -1003) {
      console.log(`Rate limit hit for ${symbol}. Retrying in 5 seconds...`);

      await sleep(5000); // cool-down retry
      return await getOrders(symbol, API_KEY, API_SECRET);
    }

    console.log(`Error fetching ${symbol}:`, msg || err);
    return [];
  }
}

app.get("/all-orders-list", async (req, res) => {
  const { API_KEY, API_SECRET } = req.body;
  const timestamp = Date.now();
  const recvWindow = 60000;

  const startTime = 0; // fetch ALL OCO orders ever created

  const query = `startTime=${startTime}&timestamp=${timestamp}&recvWindow=${recvWindow}`;

  const signature = sign(query, API_SECRET);

  const url = `https://api.binance.com/api/v3/allOrderList?${query}&signature=${signature}`;

  try {
    const res = await axios.get(url, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });

    return res.data;
  } catch (err: any) {
    // Most symbols will return: -2013 NO_SUCH_ORDER
    return [];
  }
});

interface IncomeEvent {
  asset: string;
  amount: string;
  time: number;
  type: "DIVIDEND" | "AIRDROP";
}

app.post("/all-orders-existing", async (req, res) => {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // const client = req.app.get("redis");

    // const result = await client.get("portfolio");
    const trades = await getHeldAssets(req.body.API_KEY, req.body.API_SECRET);

    // if (result) {
    //   const taxResult = calculateTax(JSON.parse(result));
    //   console.log(taxResult);

    //   const pdfName = `Binance_Asset_Source_And_Tax_Report_${Date.now()}.pdf`;
    //   const pdfPath = path.join(uploadsDir, pdfName);

    //   generateAssetSourcePdf(trades, taxResult, pdfPath);

    //   const downloadUrl = `${req.protocol}://${req.get(
    //     "host"
    //   )}/download/${pdfName}`;

    //   return res.json({
    //     downloadUrl,
    //   });
    //   //   return res.json(JSON.parse(result));
    // }

    const allSymbols = getAllCombinations();
    let results: any[] = [];

    for (const symbol of allSymbols) {
      console.log(symbol);
      const orders = await getOrders(
        symbol,
        req.body.API_KEY,
        req.body.API_SECRET
      );

      if (orders.length > 0) {
        results.push({
          symbol,
          orders,
        });
      }
    }

    console.log(results, "################################");

    // await client.set("portfolio", JSON.stringify(results));

    let formatted: any[] = [];

    // 2. Loop through each asset's trade data
    for (const item of results) {
      for (const trade of item.orders) {
        formatted.push({
          symbol: trade.symbol, // example: "ZECUSDT"
          price: trade.price, // string
          qty: trade.qty, // string
          quoteQty: trade.quoteQty, // string
          side: trade.isBuyer ? "BUY" : "SELL", // convert boolean → BUY/SELL
          time: trade.time, // timestamp
        });
      }
    }

    // Sort newest-first (optional)
    formatted.sort((a, b) => b.time - a.time);

    const taxResult = calculateTax(formatted);

    console.table(taxResult);

    const pdfName = `Binance_Asset_Source_And_Tax_Report_${Date.now()}.pdf`;

    generateAssetSourcePdf(trades, taxResult, pdfName);

    const downloadUrl = `${req.protocol}://${req.get(
      "host"
    )}/download/${pdfName}`;

    console.log(downloadUrl);

    return res.json({
      downloadUrl,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/coin-dcx-trade-history", async (req, res) => {
  const baseurl = "https://public.coindcx.com";
  const pair = "B-BTC_USDT";

  // Replace the "B-BTC_USDT" with the desired market pair.
  const url = `${baseurl}/market_data/trade_history?pair=${pair}&limit=50`;

  try {
    const response = await axios.get(url);
    // console.log(response.data);
    res.json(response.data);
  } catch (err) {
    console.error("Error:", err);
  }
});

// app.get("/users/balances", async (req, res) => {
//   try {
//     const assets = await getHeldAssets();
//     res.json(assets);
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch balances" });
//   }
// });

app.get("/users/info", async (req, res) => {
  try {
    const timeStamp = Math.floor(Date.now());

    console.log(timeStamp);

    // Place your API key and secret below. You can generate it from the website.
    const key = "f796b922abcccfbfe98845145d53f41f5d05507759ad06ca";
    const secret =
      "2ff3e7c3bb71f12b39497c24f3f1a76598e150dd999ac3bc6e6cbb88a7c48153";

    // const body = {
    //   timestamp: timeStamp,
    // };

    const body = {
      //   from_id: 352622,
      //   limit: 50,
      timestamp: timeStamp,
      //   sort: "desc",
      status: "filled",
      side: "buy",
      page: 1,
      limit: 50,
      //   from_timestamp: 1514745000000, // replace this with your from timestamp filter
      //   to_timestamp: 1514745000000, // replace this with your to timestamp filter
      //   symbol: "B-BTC_USDT", // replace this with your symbol filter
    };

    const payload = Buffer.from(JSON.stringify(body)).toString();

    console.log({ payload });

    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const baseurl = "https://api.coindcx.com";

    const response = await axios.post(
      //   baseurl + "/exchange/v1/orders/trade_history",
      baseurl + "/exchange/v1/derivatives/futures/orders",
      body,
      {
        headers: {
          "X-AUTH-APIKEY": key,
          "X-AUTH-SIGNATURE": signature,
        },
      }
    );

    console.log(response);
    // console.log(response.data);
    res.json(response.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

app.get("/asset-origins", async (req, res) => {
  const client = req.app.get("redis");

  if (client) {
    const result = await client.get("asset-origins");
    if (result) {
      return res.json(JSON.parse(result));
    }
  }

  const data = await detectOrigins();

  //   generateAssetSourcePdf(
  //     data,
  //     taxCalculationResult,
  //     "Binance_Asset_Source_And_Tax_Report.pdf"
  //   );
  //   generateBinanceHoldingsPdf(data, "Binance_Holdings_Report.pdf");

  await client.set("asset-origins", JSON.stringify(data));
  return res.json(data);
});

// export async function getAssetDividends() {
//   const timestamp = Date.now();
//   const BINANCE_BASE_URL = "https://api.binance.com";

//   // Optional params you can extend later
//   const query = `timestamp=${timestamp}`;

//   const signature = sign(query);

//   const url = `${BINANCE_BASE_URL}/sapi/v1/asset/assetDividend?${query}&signature=${signature}`;

//   const response = await axios.get(url, {
//     headers: {
//       "X-MBX-APIKEY": API_KEY,
//     },
//   });

//   console.log(response.data);
//   /*
//     Response shape:
//     {
//       rows: [
//         {
//           amount: "0.00012",
//           asset: "BNB",
//           divTime: 1693564800000,
//           enInfo: "BNB Vault Rewards"
//         }
//       ],
//       total: 1
//     }
//   */

//   return response.data;
// }
// app.get("/asset-dividents", async (req, res) => {
//   const result = await getAssetDividends();
//   return res.json(result);
// });

app.post("/csv_parser_all", upload.single("file"), async (req, res) => {
  try {
    console.log("executed...");
    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const csvPath = req.file.path;
    console.log(csvPath, "&&&&&&&&&&&&&&&&&&&&&");

    const pdfName = `FY_2024_Crypto_Tax_Report_${Date.now()}.pdf`;
    // const pdfPath = path.join(__dirname, pdfName);
    const pdfPath = path.join(process.cwd(), "uploads", pdfName);

    const data = await readCsv(csvPath);
    const result = calculateFifoForAllSymbols(data);

    await generateTaxPdf(result, pdfPath);

    const downloadUrl = `${req.protocol}://${req.get(
      "host"
    )}/download/${pdfName}`;

    return res.json({
      downloadUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate tax PDF" });
  }
});

app.get("/download/:file", (req, res) => {
  const filePath = path.join(process.cwd(), "uploads", req.params.file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(filePath);
});

const BINANCE_BASE_URL = "https://api.binance.com";

// export async function getBinanceBalances() {
//   try {
//     const timestamp = Date.now();
//     const query = `timestamp=${timestamp}`;
//     const signature = sign(query);

//     const url = `${BINANCE_BASE_URL}/api/v3/account?${query}&signature=${signature}`;

//     const res = await axios.get(url, {
//       headers: {
//         "X-MBX-APIKEY": API_KEY,
//       },
//     });

//     /*
//     returns:
//     [
//       { asset: "BTC", free: "0.00000324", locked: "0.00000000" },
//       ...
//     ]
//   */
//     return res.data.balances;
//   } catch (err) {
//     console.error(err);
//     return [];
//   }
// }

// export async function getAssetIncome() {
//   const timestamp = Date.now();
//   const query = `timestamp=${timestamp}`;
//   const signature = sign(query);

//   const url = `${BINANCE_BASE_URL}/sapi/v1/asset/assetDividend?${query}&signature=${signature}`;

//   const res = await axios.get(url, {
//     headers: {
//       "X-MBX-APIKEY": API_KEY,
//     },
//   });

//   /*
//     Example item:
//     {
//       asset: "PEPE",
//       incomeType: "AIRDROP",
//       income: "1384280",
//       time: 1693564800000
//     }
//   */
//   //   console.log(res, "$$$$$$$$$$$$$$$$$$$$");
//   return res.data;
// }

// export async function getAllSpotTrades(
//   symbols: string[],
//   delayMs = 300 // ~3 req/sec (safe)
// ) {
//   const allTrades: any[] = [];

//   for (const symbol of symbols) {
//     console.log(symbol);
//     let success = false;
//     let attempts = 0;

//     while (!success && attempts < 5) {
//       try {
//         const timestamp = Date.now();
//         const query = `symbol=${symbol}&timestamp=${timestamp}`;
//         const signature = sign(query);

//         const url = `${BINANCE_BASE_URL}/api/v3/myTrades?${query}&signature=${signature}`;

//         const res = await axios.get(url, {
//           headers: {
//             "X-MBX-APIKEY": API_KEY,
//           },
//         });

//         allTrades.push(...res.data);
//         success = true;

//         // ✅ throttle next request
//         await sleep(delayMs);
//       } catch (err: any) {
//         attempts++;

//         // 🔁 Retry on rate limit
//         if (err.response?.status === 429) {
//           const wait = delayMs * attempts;
//           console.warn(`Rate limit hit for ${symbol}. Retrying in ${wait}ms`);
//           await sleep(wait);
//         } else {
//           console.error(`Failed for ${symbol}`, err.message);
//           break; // real error → skip symbol
//         }
//       }
//     }
//   }

//   return allTrades;
// }

// const balances = await getBinanceBalances(); // /api/v3/account
// const income = await getAssetIncome(); // /sapi/v1/asset/income

// console.log(income, "###################");
// const trades = await getAllSpotTrades(exchangePairs); // /api/v3/myTrades

// const classified = classifyAssets(balances, income, trades);

// generateAssetSourcePdf(classified, "Binance_Asset_Source_Report.pdf");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
