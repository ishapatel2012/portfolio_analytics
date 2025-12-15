"use client";

import { useState } from "react";
import "./styles/apiForm.css";

type ApiResponse = {
  downloadUrl: string;
};

export default function APIKeyForm() {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!apiKey || !secretKey) {
      setError("API key and Secret key are required");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        "http://localhost:5000/all-orders-existing",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            API_KEY: apiKey,
            API_SECRET: secretKey,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("API request failed");
      }

      const data: ApiResponse = await res.json();

      if (!data.downloadUrl) {
        throw new Error("Download URL missing");
      }

      // ✅ IMPORTANT: Let browser download directly
      window.open(data.downloadUrl, "_blank");

    } catch (err) {
      setError("Failed to fetch exchange data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-card">
      <h2 className="api-title">Connect Exchange API</h2>

      <input
        type="text"
        placeholder="API Key"
        className="api-input"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <input
        type="password"
        placeholder="Secret Key"
        className="api-input"
        value={secretKey}
        onChange={(e) => setSecretKey(e.target.value)}
      />

      {error && (
        <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>
      )}

      <button
        className="api-btn"
        onClick={handleConnect}
        disabled={loading}
      >
        {loading ? "Fetching Orders..." : "Connect & Download"}
      </button>
    </div>
  );
}
