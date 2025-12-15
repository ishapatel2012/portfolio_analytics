import PDFDocument from "pdfkit";
import fs from "fs";
import type { AssetClassification } from "./binanceHistory.js";
export interface TaxResult {
  symbol: string;
  sellQty: number;
  sellValue: number;
  cost: number;
  profit: number;
  tax: number;
}
export async function generateAssetSourcePdf(
  assets: AssetClassification[],
  taxResults: TaxResult[], // 👈 NEW
  outputPath: string
) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(fs.createWriteStream(outputPath));

  /* =========================
     HEADER
  ========================= */
  doc.fontSize(14).text("Binance Asset Source Report");
  doc.fontSize(10).text(`Generated on: ${new Date().toUTCString()}`);
  doc.moveDown(1);

  const startX = 40;
  let y = doc.y;
  const rowH = 20;

  /* =========================
     TABLE 1 — ASSET SOURCES
  ========================= */
  const col1 = {
    asset: startX,
    free: startX + 120,
    // source: startX + 260,
  };

  doc.font("Helvetica-Bold");
  doc.text("Asset", col1.asset, y);
  doc.text("Quantity", col1.free, y);
  //   doc.text("Source Type", col1.source, y);

  y += rowH;
  doc
    .moveTo(startX, y - 5)
    .lineTo(550, y - 5)
    .stroke();
  doc.font("Helvetica");

  for (const row of assets) {
    console.log(row);
    const qty = Number(row.free) || 0;

    // break;
    doc.text(row.asset, col1.asset, y);
    doc.text(qty.toFixed(8), col1.free, y);
    // doc.text(row.sources.join(", "), col1.source, y);
    y += rowH;

    if (y > 750) {
      doc.addPage();
      y = 40;
    }
  }

  /* =========================
     SPACE BEFORE TAX TABLE
  ========================= */
  doc.moveDown(2);
  y = doc.y;

  /* =========================
     TABLE 2 — TAX CALCULATION
  ========================= */
  doc.font("Helvetica-Bold").text("Tax Calculation Summary", startX, y);
  doc.moveDown(0.5);
  y = doc.y;

  const col2 = {
    symbol: startX,
    sellQty: startX + 90,
    profit: startX + 200,
    tax: startX + 320,
  };

  doc.text("Symbol", col2.symbol, y);
  doc.text("Sold Qty", col2.sellQty, y);
  doc.text("Profit", col2.profit, y);
  doc.text("Tax (30%)", col2.tax, y);

  y += rowH;
  doc
    .moveTo(startX, y - 5)
    .lineTo(550, y - 5)
    .stroke();
  doc.font("Helvetica");

  let totalProfit = 0;
  let totalTax = 0;

  for (const t of taxResults) {
    doc.text(t.symbol, col2.symbol, y);
    doc.text(t.sellQty.toFixed(6), col2.sellQty, y);
    doc.text(t.profit.toFixed(2), col2.profit, y);
    doc.text(t.tax.toFixed(2), col2.tax, y);

    totalProfit += t.profit;
    totalTax += t.tax;

    y += rowH;

    if (y > 750) {
      doc.addPage();
      y = 40;
    }
  }

  /* =========================
     TAX TOTALS
  ========================= */
  y += 5;
  doc.moveTo(startX, y).lineTo(550, y).stroke();
  y += 5;

  doc.font("Helvetica-Bold");
  doc.text("TOTAL", col2.symbol, y);
  doc.text(totalProfit.toFixed(2), col2.profit, y);
  doc.text(totalTax.toFixed(2), col2.tax, y);

  doc.end();
}
