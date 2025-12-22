"use client";

import { useState } from "react";
import "./styles/exchangeCsv.css";

export default function ExchangeCSVUpload() {
  const [exchange, setExchange] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="exchange-card">
      <h2 className="exchange-title">Exchange CSV Upload</h2>

      {/* Exchange Dropdown */}
      <select
        className="exchange-select"
        value={exchange}
        onChange={(e) => setExchange(e.target.value)}
      >
        <option value="">Select Exchange</option>
        <option value="coinswitch">CoinSwitch</option>
        <option value="coindcx">CoinDCX</option>
        <option value="binance">Binance</option>
      </select>

      {/* CSV Upload */}
      <input
        type="file"
        accept=".csv"
        className="exchange-file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button className="exchange-btn">
        Upload CSV
      </button>
    </div>
  );
}
