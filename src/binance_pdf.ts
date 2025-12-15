import PDFDocument from "pdfkit";
import fs from "fs";

interface BinanceBalance {
  asset: string;
  free: string;
  type: string;
}

export function generateBinanceHoldingsPdf(
  balances: BinanceBalance[],
  outputPath: string
) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(fs.createWriteStream(outputPath));

  // Title
  doc.fontSize(14).text("Binance Holdings Report");
  doc.fontSize(10).text(`Generated on: ${new Date().toUTCString()}`);
  doc.moveDown(1);

  // Table config
  const startX = 40;
  let y = doc.y;
  const rowH = 20;

  const col = {
    token: startX,
    qty: startX + 200,
    type: startX + 400,
  };

  // Header
  doc.font("Helvetica-Bold");
  doc.text("Token", col.token, y);
  doc.text("Quantity (Free)", col.qty, y);
  doc.text("Type", col.type, y);

  y += rowH;
  doc
    .moveTo(startX, y - 5)
    .lineTo(350, y - 5)
    .stroke();
  doc.font("Helvetica");

  // Rows
  for (const b of balances) {
    ``;
    const qty = Number(b.free);

    // Optional: skip zero balance
    if (qty === 0) continue;

    doc.text(b.asset, col.token, y);
    doc.text(qty.toFixed(8), col.qty, y);
    doc.text(b.type, col.type, y);
    y += rowH;

    // Page break safety
    if (y > 750) {
      doc.addPage();
      y = 40;
    }
  }

  doc.end();
}
