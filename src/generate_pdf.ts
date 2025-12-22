import PDFDocument from "pdfkit";
import fs from "fs";

interface CoinTaxResult {
  symbol: string;
  totalSold: number;
  totalProfit: number;
  tax: number;
  netProfit: number;
  payableTax: number;
  remainingQty?: number;
  createdAt: number;
}

export async function generateTaxPdf(
  results: CoinTaxResult[],
  outputPath: string
) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(fs.createWriteStream(outputPath));

  // Title
  doc.fontSize(14).text("Consolidated Tax Report");
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Generated on: ${new Date().toUTCString()}`);
  doc.moveDown(1);

  // Table config
  const startX = 40;
  let y = doc.y;
  const rowHeight = 20;

  const col = {
    symbol: startX,
    qty: startX + 50,
    profit: startX + 140,
    tax: startX + 220,
    net: startX + 290,
    payableTax: startX + 370,
    createdAt: startX + 440,
  };

  // Header
  doc.font("Helvetica-Bold");
  doc.text("Token", col.symbol, y);
  doc.text("Quantity", col.qty, y);
  doc.text("Profit", col.profit, y);
  doc.text("Tax on Trade", col.tax, y);
  doc.text("Effective Profit", col.net, y);
  doc.text("Payable Tax", col.payableTax, y);
  doc.text("Sell Date", col.createdAt, y);

  y += rowHeight;
  doc
    .moveTo(startX, y - 5)
    .lineTo(550, y - 5)
    .stroke();

  // Rows
  doc.font("Helvetica");

  let totalProfit = 0;
  let totalTax = 0;
  let totalNet = 0;
  let totalPayableTax = 0;

  for (const r of results) {
    // if (r.totalProfit === 0) continue;
    if (r.totalSold === 0) continue;
    doc.text(r.symbol, col.symbol, y);

    doc.text(r.totalSold.toFixed(6), col.qty, y);
    doc.text(r.totalProfit.toFixed(2), col.profit, y);
    doc.text(r.tax.toFixed(2), col.tax, y);
    doc.text(r.netProfit.toFixed(2), col.net, y);
    doc.text(r.payableTax.toFixed(2), col.payableTax, y);
    doc.text(
      //@ts-ignore
      new Date(r.createdAt).toISOString().split("T")[0],
      col.createdAt,
      y
    );

    totalProfit += r.totalProfit;
    totalTax += r.tax;
    totalNet += r.netProfit;
    totalPayableTax += r.payableTax;

    y += rowHeight;
  }

  // Total row
  y += 5;
  doc.moveTo(startX, y).lineTo(550, y).stroke();
  y += 5;

  doc.font("Helvetica-Bold");
  doc.text("TOTAL", col.symbol, y);
  doc.text(totalProfit.toFixed(2), col.profit, y);
  doc.text(totalTax.toFixed(2), col.tax, y);
  doc.text(totalNet.toFixed(2), col.net, y);
  doc.text(totalPayableTax.toFixed(2), col.payableTax, y);
  //   doc.text(new Date().toUTCString(), col.createdAt, y);

  /* ============================
     TABLE 2 — REMAINING HOLDINGS
  ============================ */

  doc.moveDown(2);

  // RESET X POSITION TO LEFT
  doc.x = 40;

  doc.font("Helvetica-Bold").text("Crypto Portfolio", {
    align: "left",
  });

  doc.moveDown(1);

  y = doc.y;
  const col2 = {
    symbol: startX,
    qty: startX + 150,
  };

  doc.text("Symbol", col2.symbol, y);
  doc.text("Remaining Qty", col2.qty, y);

  y += rowHeight;
  doc
    .moveTo(startX, y - 5)
    .lineTo(350, y - 5)
    .stroke();
  doc.font("Helvetica");

  for (const r of results) {
    // if (r.remainingQty != undefined) {
    // if (r?.remainingQty !== undefined && r?.remainingQty !== 0) continue;
    console.log(r.symbol, "remainingQty");
    doc.text(r.symbol, col2.symbol, y);
    //@ts-ignore
    doc.text(r.remainingQty.toFixed(6), col2.qty, y);
    y += rowHeight;
    // }
  }

  doc.end();
}

export async function generateTaxPdfBinanceUnified(
  results: CoinTaxResult[],
  outputPath: string
) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(fs.createWriteStream(outputPath));

  const PAGE_TOP = 40;
  const PAGE_BOTTOM = 750;
  const ROW_HEIGHT = 20;
  const START_X = 40;

  /* ============================
     HEADER
  ============================ */
  doc.fontSize(14).text("Consolidated Tax Report");
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Generated on: ${new Date().toUTCString()}`);
  doc.moveDown(1);

  let y = doc.y;

  /* ============================
     TABLE 1 — TAX SUMMARY
  ============================ */
  const col1 = {
    symbol: START_X,
    qty: START_X + 50,
    profit: START_X + 140,
    tax: START_X + 220,
    net: START_X + 290,
    payableTax: START_X + 370,
    createdAt: START_X + 440,
  };

  function drawTaxHeader() {
    doc.font("Helvetica-Bold");
    doc.text("Token", col1.symbol, y);
    doc.text("Quantity", col1.qty, y);
    doc.text("Profit", col1.profit, y);
    doc.text("Tax on Trade", col1.tax, y);
    doc.text("Effective Profit", col1.net, y);
    doc.text("Payable Tax", col1.payableTax, y);
    doc.text("Sell Date", col1.createdAt, y);

    y += ROW_HEIGHT;
    doc
      .moveTo(START_X, y - 5)
      .lineTo(550, y - 5)
      .stroke();
    doc.font("Helvetica");
  }

  drawTaxHeader();

  let totalProfit = 0;
  let totalTax = 0;
  let totalNet = 0;
  let totalPayableTax = 0;

  for (const r of results) {
    if (r.totalSold === 0) continue;

    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = PAGE_TOP;
      drawTaxHeader();
    }

    doc.text(r.symbol, col1.symbol, y);
    doc.text(r.totalSold.toFixed(6), col1.qty, y);
    doc.text(r.totalProfit.toFixed(2), col1.profit, y);
    doc.text(r.tax.toFixed(2), col1.tax, y);
    doc.text(r.netProfit.toFixed(2), col1.net, y);
    doc.text(r.payableTax.toFixed(2), col1.payableTax, y);
    doc.text(
      //@ts-ignore
      new Date(r.createdAt).toISOString().split("T")[0],
      col1.createdAt,
      y
    );

    totalProfit += r.totalProfit;
    totalTax += r.tax;
    totalNet += r.netProfit;
    totalPayableTax += r.payableTax;

    y += ROW_HEIGHT;
  }

  // Totals row
  y += 5;
  doc.moveTo(START_X, y).lineTo(550, y).stroke();
  y += 5;

  doc.font("Helvetica-Bold");
  doc.text("TOTAL", col1.symbol, y);
  doc.text(totalProfit.toFixed(2), col1.profit, y);
  doc.text(totalTax.toFixed(2), col1.tax, y);
  doc.text(totalNet.toFixed(2), col1.net, y);
  doc.text(totalPayableTax.toFixed(2), col1.payableTax, y);

  /* ============================
     TABLE 2 — REMAINING HOLDINGS
  ============================ */
  doc.addPage();
  y = PAGE_TOP;

  doc.font("Helvetica-Bold").text("Crypto Portfolio");
  doc.moveDown(1);
  y = doc.y;

  const col2 = {
    symbol: START_X,
    qty: START_X + 150,
  };

  function drawHoldingsHeader() {
    doc.font("Helvetica-Bold");
    doc.text("Symbol", col2.symbol, y);
    doc.text("Remaining Qty", col2.qty, y);

    y += ROW_HEIGHT;
    doc
      .moveTo(START_X, y - 5)
      .lineTo(350, y - 5)
      .stroke();
    doc.font("Helvetica");
  }

  drawHoldingsHeader();

  for (const r of results) {
    if (r.remainingQty === undefined || r.remainingQty === 0) continue;

    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = PAGE_TOP;
      drawHoldingsHeader();
    }

    doc.text(r.symbol, col2.symbol, y);
    doc.text(r.remainingQty.toFixed(6), col2.qty, y);
    y += ROW_HEIGHT;
  }

  doc.end();
}
