"use client";

import Header from "./components/Header";
import APIKeyForm from "./components/APIKeyForm";
import CSVUploadForm from "./components/CSVUploadFrom";
import ExchangeCSVUpload from "./components/ExchangeCSVUpload";

  export default function Page() {
  return (
    <div style={{ padding: "40px" }}>
      <Header />

      <div
        style={{
          marginTop: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "30px",
          width: "100%",
        }}
      >
        {/* CSV box (top) */}
        <div style={{ width: "50%" }}>
          <CSVUploadForm />
        </div>

        {/* API Key box (bottom) */}
        <div style={{ width: "50%" }}>
          <APIKeyForm />
        </div>

        {/* Exchange CSV box (bottom) */}
        <div style={{ width: "50%" }}>
          <ExchangeCSVUpload />
        </div>
      </div>
    </div>
  );
}
