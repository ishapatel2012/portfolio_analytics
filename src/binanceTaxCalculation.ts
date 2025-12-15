export function calculateTax(
  data: {
    symbol: string;
    orders: any[];
  }[],
  taxRate = 0.3
) {
  const results: any[] = [];

  for (const item of data) {
    // HARD GUARD
    if (!item || !Array.isArray(item.orders)) {
      continue;
    }

    const symbol = item.symbol;

    const buys = item.orders
      .filter((o) => o.side === "BUY" && o.status === "FILLED")
      .map((o) => ({
        qty: Number(o.executedQty),
        cost: Number(o.cummulativeQuoteQty || 0),
        price: Number(o.price),
        time: o.time,
      }))
      .sort((a, b) => a.time - b.time);

    const sells = item.orders
      .filter((o) => o.side === "SELL" && o.status === "FILLED")
      .map((o) => ({
        qty: Number(o.executedQty),
        value: Number(o.cummulativeQuoteQty || 0),
        time: o.time,
      }))
      .sort((a, b) => a.time - b.time);

    if (sells.length === 0) continue;

    let totalSellQty = 0;
    let totalSellValue = 0;
    let totalCost = 0;

    for (const sell of sells) {
      let remainingSell = sell.qty;

      totalSellQty += sell.qty;
      totalSellValue += sell.value;

      for (const buy of buys) {
        if (remainingSell <= 0) break;
        if (buy.qty <= 0) continue;

        const used = Math.min(remainingSell, buy.qty);

        // Allocate cost
        let cost = 0;
        if (buy.cost > 0 && buy.qty > 0) {
          cost = (buy.cost / buy.qty) * used;
        } else if (buy.price > 0) {
          cost = used * buy.price;
        }

        totalCost += cost;
        buy.qty -= used;
        remainingSell -= used;
      }

      // 🔴 No buy available → 100% profit
      if (remainingSell > 0) {
        const unitValue = sell.value / sell.qty;
        totalSellValue += remainingSell * unitValue;
      }
    }

    const profit = totalSellValue - totalCost;
    const tax = profit * taxRate;

    results.push({
      symbol,
      sellQty: totalSellQty,
      sellValue: Number(totalSellValue.toFixed(6)),
      cost: Number(totalCost.toFixed(6)),
      profit: Number(profit.toFixed(6)),
      tax: Number(tax.toFixed(6)),
    });
  }

  return results;
}
