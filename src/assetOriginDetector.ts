import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import { exchangePairs } from "./exchangePais.js";

dotenv.config();

const API_KEY = process.env.BINANCE_API_KEY!;
const API_SECRET = process.env.BINANCE_API_SECRET!;

function sign(query: string) {
  return crypto.createHmac("sha256", API_SECRET).update(query).digest("hex");
}

async function signedGet(url: string, params: any = {}) {
  const timestamp = Date.now();
  const recvWindow = 60000;

  const q = new URLSearchParams({
    ...params,
    timestamp: timestamp.toString(),
    recvWindow: recvWindow.toString(),
  });

  const signature = sign(q.toString());
  const finalUrl = `${url}?${q.toString()}&signature=${signature}`;

  try {
    const res = await axios.get(finalUrl, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });
    return res.data;
  } catch {
    return []; // return empty on errors
  }
}

export async function detectOrigins() {
  // -------------------------------
  // 1️⃣ GET ALL BALANCES
  // -------------------------------
  const account = await signedGet("https://api.binance.com/api/v3/account");

  const balances = account.balances.filter(
    (b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
  );

  const results: any[] = [];

  // -------------------------------
  // 2️⃣ CHECK ORIGIN FOR EACH ASSET
  // -------------------------------
  for (const { asset, free } of balances) {
    console.log({ asset });
    // Skip stablecoins; they can come from anywhere
    // if (asset === "USDT" || asset === "USDC" || asset === "BUSD") {
    //   results.push({
    //     asset,
    //     free,
    //     origin: "Stablecoin balance (various sources possible)",
    //   });
    //   continue;
    // }

    let foundOrigin = false;

    // Possible quote assets for Spot trades
    const QUOTES = exchangePairs;

    // -------------------------------
    // 2.1 — Check SPOT TRADE HISTORY
    // -------------------------------
    for (const quote of QUOTES) {
      const symbol = quote;

      const trades = await signedGet(
        "https://api.binance.com/api/v3/myTrades",
        { symbol }
      );
      if (trades.length > 0) {
        results.push({
          asset,
          free,
          origin: `Spot Trading (${symbol})`,
          symbol,
          trades,
        });
        foundOrigin = true;
        break;
      }
    }

    if (foundOrigin) continue;

    // -------------------------------
    // 2.2 — Check DUST CONVERSION LOGS
    // -------------------------------
    const dust = await signedGet(
      "https://api.binance.com/sapi/v1/asset/dribblet"
    );
    if (dust.length > 0) {
      for (const item of dust) {
        for (const entry of item.userAssetDribbletDetails) {
          if (entry.fromAsset === asset) {
            results.push({
              asset,
              free,
              origin: "Dust Conversion (converted into BNB)",
              details: entry,
            });
            foundOrigin = true;
            break;
          }
        }
      }
    }

    if (foundOrigin) continue;

    // -------------------------------
    // 2.3 — Check EARN / STAKING / INTEREST REWARDS
    // -------------------------------
    const dividends = await signedGet(
      "https://api.binance.com/sapi/v1/asset/assetDividend"
    );
    if (dividends.length > 0) {
      const divMatch = dividends.find((d: any) => d.asset === asset);
      if (divMatch) {
        results.push({
          asset,
          free,
          origin: "Earn/Staking Rewards",
          details: divMatch,
        });
        foundOrigin = true;
        continue;
      }
    }

    // -------------------------------
    // 2.4 — Check INTERNAL TRANSFERS
    // -------------------------------
    const transfers = await signedGet(
      "https://api.binance.com/sapi/v1/asset/transfer"
    );
    const incoming = transfers.filter((t: any) => t.asset === asset);
    if (incoming.length > 0) {
      results.push({
        asset,
        free,
        origin: "Internal Binance Transfer (Spot/Funding/Earn)",
        details: incoming,
      });
      foundOrigin = true;
      continue;
    }

    // -------------------------------
    // 2.5 — No origin found → Airdrop / Convert
    // -------------------------------
    results.push({
      asset,
      free,
      origin: "Likely Convert, Airdrop, or Promotional Distribution",
    });
  }

  return results;
}
