"use client";

import { useState } from "react";
import "./styles/exchangeCsv.css";

type ApiResponse = {
  downloadUrl: string;
};

export default function ExchangeCSVUpload() {
  const [exchange, setExchange] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!exchange) {
      setError("Please select an exchange");
      return;
    }

    if (!file) {
      setError("Please upload a CSV file");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("exchangeName", exchange); // IMPORTANT
      formData.append("file", file);

      const res = await fetch(
        "http://localhost:5000/unified-tax-calculator",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data: ApiResponse = await res.json();

      if (!data.downloadUrl) {
        throw new Error("Download URL missing");
      }

      // ✅ Let browser download directly
      window.open(data.downloadUrl, "_blank");
    } catch (err) {
      setError("Failed to generate tax report");
    } finally {
      setLoading(false);
    }
  };

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

      {error && (
        <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>
      )}

      <button
        className="exchange-btn"
        onClick={handleUpload}
        disabled={loading}
      >
        {loading ? "Processing..." : "Upload & Download"}
      </button>
    </div>
  );
}
