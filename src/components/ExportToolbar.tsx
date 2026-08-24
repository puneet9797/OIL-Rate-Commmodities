"use client";

import { useCallback } from "react";
import * as XLSX from "xlsx";
import { RatesData } from "@/types";

interface ExportToolbarProps {
  data: RatesData | null;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function ExportToolbar({ data, showToast }: ExportToolbarProps) {
  const handlePrint = useCallback(() => {
    showToast("Opening print dialog...", "info");
    window.print();
  }, [showToast]);

  const handleExcelExport = useCallback(() => {
    console.log("Export button clicked. Data:", data);
    try {
      if (!data || !data.rows || data.rows.length === 0) {
        showToast("No data available to export.", "error");
        return;
      }

      showToast("Preparing Excel sheet...", "info");

      // Build worksheet data: header row + data rows
      console.log("Building worksheet data...");
      const wsData: string[][] = [data.columns];
      data.rows.forEach((row) => {
        wsData.push(row.values);
      });

      console.log("Converting AOA to sheet...");
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-size columns
      console.log("Calculating column widths...");
      const colWidths = data.columns.map((col, i) => {
        const maxLen = Math.max(
          col.length,
          ...data.rows.map((r) => (r.values[i] || "").length)
        );
        return { wch: Math.min(maxLen + 4, 30) };
      });
      ws["!cols"] = colWidths;

      console.log("Creating workbook...");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Live Rates");

      // Generate and download
      const now = new Date();
      const filename = `LiveRates_${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours()
      ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.xlsx`;

      console.log("Writing sheet binary data...");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "binary" });

      console.log("Creating buffer...");
      const buf = new ArrayBuffer(wbout.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < wbout.length; i++) {
        view[i] = wbout.charCodeAt(i) & 0xff;
      }

      console.log("Creating Blob...");
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      console.log("Triggering download link click for filename:", filename);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("Manual Excel download triggered successfully.");
      showToast("Excel downloaded successfully!", "success");
    } catch (err) {
      console.error("Uncaught error during Excel export:", err);
      showToast("Excel export failed.", "error");
    }
  }, [data, showToast]);

  const hasData = data && data.rows.length > 0;

  return (
    <div className="export-toolbar">
      <button
        className="btn btn-secondary"
        onClick={handlePrint}
        disabled={!hasData}
        title="Print rates table"
        id="btn-print"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Print
      </button>

      <button
        className="btn btn-success"
        onClick={handleExcelExport}
        disabled={!hasData}
        title="Export to Excel (.xlsx)"
        id="btn-export-excel"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export Excel
      </button>
    </div>
  );
}
