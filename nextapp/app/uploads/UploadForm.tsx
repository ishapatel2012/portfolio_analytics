"use client";

import { useState } from "react";
import styles from "./UploadForm.module.css";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Select a CSV file");

    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000)); // test delay
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Upload CSV → Get PDF</h2>

        <input
          type="file"
          accept=".csv"
          className={styles.fileInput}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button className={styles.button} disabled={loading}>
          {loading ? "Generating..." : "Upload"}
        </button>
      </form>
    </div>
  );
}
