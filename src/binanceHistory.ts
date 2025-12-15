const INCOME_TYPE_MAP: Record<any, any> = {
  SPOT: "SPOT_TRADING",
  AIRDROP: "AIRDROP",
  STAKING: "STAKING_REWARD",
  LAUNCHPOOL: "LAUNCHPOOL",
  SAVINGS: "SAVINGS_REWARD",
  FUNDING_FEE: "FUNDING_FEE",
  REBATE: "FEE_REBATE",
  MINING: "MINING_REWARD",
  NFT: "NFT_REWARD",
};

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface AssetClassification {
  free: any;
  asset: string;
  qty: number;
  sources: string[]; // MULTIPLE sources
}

export function classifyAssets(
  balances: BinanceBalance[],
  incomeEvents: any[],
  spotTrades: any[]
): AssetClassification[] {
  // 1️⃣ Build income source map (asset → set of income types)
  const incomeSourceMap = new Map<string, Set<string>>();

  for (const inc of incomeEvents) {
    const mapped = INCOME_TYPE_MAP[inc.enInfo] ?? inc.enInfo;

    console.log(mapped);

    if (!incomeSourceMap.has(inc.asset)) {
      incomeSourceMap.set(inc.asset, new Set());
    }

    incomeSourceMap.get(inc.asset)!.add(mapped);
  }

  // 2️⃣ Build traded asset set
  const tradedAssets = new Set<string>();
  for (const t of spotTrades) {
    // BTCUSDT → BTC (safe for USDT pairs)
    const base = t.symbol.replace(/USDT$/, "");
    tradedAssets.add(base);
  }

  // 3️⃣ Classify each balance asset
  const result: AssetClassification[] = [];

  for (const b of balances) {
    const qty = Number(b.free);
    if (qty === 0) continue;

    const sources = new Set<string>();

    // income-based classification
    if (incomeSourceMap.has(b.asset)) {
      for (const s of incomeSourceMap.get(b.asset)!) {
        sources.add(s);
      }
    }

    // trading-based classification
    if (tradedAssets.has(b.asset)) {
      sources.add("SPOT_TRADING");
    }

    // fallback
    if (sources.size === 0) {
      sources.add("TRANSFER_OR_UNKNOWN");
    }

    result.push({
      asset: b.asset,
      qty,
      sources: Array.from(sources),
      free: b.free,
    });
  }

  return result;
}
