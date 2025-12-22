// types.ts
export interface UnifiedTrade {
  "Order ID": string;
  "Created At": string;
  Currency: string;
  Side: "BUY" | "SELL";
  // price_inr: number;
  "Total Quantity": number;
  "Price Per Unit": number;
  "Total Amount": number;
  fee_inr: number;
  net_inr: number;
  "TDS Amount": number;
  source: "INSTANT" | "SPOT";
}

export interface binanceUnifiedTrade {
  "Created At": Date;
  Currency: string;
  Side: "BUY" | "SELL";
  "Total Quantity": number;
  "Price Per Unit": number;
  "Total Amount": number;
  source: string;
}

export type TradeSide = "BUY" | "SELL";

export const INCOMING_OPERATIONS = new Set<string>([
  "Deposit",
  "Buy",
  "Distribution",
  "Staking Rewards",
  "Launchpool Airdrop - User Claim Distribution",
  "Commission History",
  "Transaction Revenue",
  "Commission Rebate",
  "Airdrop Assets",
  "Token Swap - Redenomination/Rebranding",
  "Simple Earn Locked Rewards",
  "Launchpool Airdrop - System Distribution",
  "Asset Recovery",
  "Megadrop Rewards",
  "Token Swap - Distribution",
  "HODLer Airdrops Distribution",
  "Transaction Buy",
]);

export const OUTGOING_OPERATIONS = new Set<string>([
  "Sell",
  "Fee",
  "Withdraw",
  "Asset - Transfer",
  "Launchpool Subscription/Redemption",
  "Transfer Between Main And Mining Account",
  "Transaction Spend",
  "Transaction Fee",
  "Transaction Sold",
  "Simple Earn Locked Subscription",
]);
