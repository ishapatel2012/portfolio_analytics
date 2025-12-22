"use client";

import { useState } from "react";
import "./styles/csvForm.css";

type UploadResponse = {
  downloadUrl: string;
};

export default function CSVUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
  if (!file) {
    setError("Please select a CSV file");
    return;
  }

  setError(null);
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append("file", file);

        const uploadRes = await fetch("http://localhost:5000/csv_parser_all", {
          method: "POST",
          body: formData,
        });

    //  const uploadRes = await fetch("https://portfolio-analytics-eta.vercel.app/csv_parser_all", {
    //   method: "POST",
    //   body: formData,
    // });

    if (!uploadRes.ok) {
      throw new Error("CSV upload failed");
    }

    const data = await uploadRes.json();

    if (!data.downloadUrl) {
      throw new Error("Download URL missing");
    }

     // Create a temporary link to trigger the download seamlessly
    const link = document.createElement("a");
    link.href = data.downloadUrl;
    link.setAttribute("download", "Tax_Report.pdf"); // Hint to the browser to download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (err) {
    setError("Failed to process CSV");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="csv-card">
      <h2 className="csv-title">Upload CSV → Get PDF</h2>

      <input
        type="file"
        accept=".csv"
        className="csv-input"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      {error && (
        <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>
      )}

      <button className="csv-btn" onClick={handleUpload} disabled={loading}>
        {loading ? "Processing..." : "Upload"}
      </button>
    </div>
  );
}
