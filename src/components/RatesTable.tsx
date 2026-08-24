"use client";

import { useEffect, useState } from "react";
import { RateRow } from "@/types";

interface RatesTableProps {
  columns: string[];
  rows: RateRow[];
  previousRows?: RateRow[];
}

/**
 * Detect if a row is a category/group header (e.g., "KLC", "CBOT").
 * These rows typically have only the first cell populated, rest are empty.
 */
function isGroupHeader(row: RateRow): boolean {
  if (row.values.length === 0) return false;
  const firstVal = row.values[0]?.trim();
  if (!firstVal) return false;
  // Check if most other cells are empty
  const filledCount = row.values.filter((v) => v.trim() !== "").length;
  return filledCount <= 2 && row.netChange === null;
}

/**
 * Parse group headers to apply specific styles and emojis/icons matching the screenshot
 */
function getGroupHeaderStyle(name: string): {
  className: string;
  icon: string;
} {
  const normalized = name.toUpperCase().trim();
  
  if (normalized.includes("FOREX")) {
    return { className: "group-header-forex", icon: "💵" };
  }
  if (normalized.includes("CRUDE")) {
    return { className: "group-header-crude", icon: "💧" };
  }
  if (normalized.includes("KLC")) {
    return { className: "group-header-klc", icon: "🏛️" };
  }
  if (normalized === "CBOT") {
    return { className: "group-header-cbot", icon: "🌐" };
  }
  
  // Subcategories
  if (normalized === "OIL") {
    return { className: "group-header-sub-oil", icon: "💧" };
  }
  if (normalized === "SEED") {
    return { className: "group-header-sub-seed", icon: "🌱" };
  }
  if (normalized === "METAL") {
    return { className: "group-header-sub-metal", icon: "🔺" };
  }
  if (normalized === "CASTOR") {
    return { className: "group-header-sub-castor", icon: "⚙️" };
  }

  return { className: "group-header-default", icon: "📂" };
}

// Column header SVGs matching the screenshot
const columnIcons: Record<string, React.ReactNode> = {
  ItemName: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Ltp: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  NetChange: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  BuyQty: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  SellQty: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  BuyPrice: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  SellPrice: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  High: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  Low: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  ),
  Open: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Close: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="th-icon">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
};

export default function RatesTable({
  columns,
  rows,
  previousRows,
}: RatesTableProps) {
  const [flashCells, setFlashCells] = useState<
    Map<string, "green" | "red" | "neutral">
  >(new Map());

  // Detect changes and trigger flash animations
  useEffect(() => {
    if (!previousRows || previousRows.length === 0) return;

    const newFlashes = new Map<string, "green" | "red" | "neutral">();
    let hasChanges = false;

    rows.forEach((row, rowIdx) => {
      if (isGroupHeader(row)) return;
      const prevRow = previousRows[rowIdx];
      if (!prevRow) return;

      row.values.forEach((val, colIdx) => {
        if (prevRow.values[colIdx] !== val) {
          hasChanges = true;
          const prevNum = parseFloat(prevRow.values[colIdx]);
          const curNum = parseFloat(val);

          if (!isNaN(prevNum) && !isNaN(curNum)) {
            newFlashes.set(
              `${rowIdx}-${colIdx}`,
              curNum > prevNum ? "green" : curNum < prevNum ? "red" : "neutral"
            );
          } else {
            newFlashes.set(`${rowIdx}-${colIdx}`, "neutral");
          }
        }
      });
    });

    if (hasChanges) {
      setFlashCells(newFlashes);
      const timeout = setTimeout(() => setFlashCells(new Map()), 1500);
      return () => clearTimeout(timeout);
    }
  }, [rows, previousRows]);

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <div className="empty-title">No Rate Data Available</div>
        <div className="empty-desc">
          Configure your API settings and ensure the connection is active to
          see live rates.
        </div>
      </div>
    );
  }

  // Determine the NetChange column index
  const netCol = columns.findIndex((c) =>
    c.toLowerCase().includes("net")
  );

  // Column display names
  const columnLabels: Record<string, string> = {
    ItemName: "Item Name",
    Ltp: "Ltp",
    NetChange: "NetChange",
    BuyQty: "BuyQty",
    SellQty: "SellQty",
    BuyPrice: "BuyPrice",
    SellPrice: "SellPrice",
    Low: "Low",
    High: "High",
    Open: "Open",
    Close: "Close",
  };

  return (
    <div className="rates-table-wrapper">
      <table className="rates-table" id="rates-data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                  {columnIcons[col] || null}
                  <span>{columnLabels[col] || col}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            // Group header row (FOREX, KLC, CBOT, etc.)
            if (isGroupHeader(row)) {
              const { className, icon } = getGroupHeaderStyle(row.values[0]);
              return (
                <tr key={rowIdx} className="group-header-row">
                  <td colSpan={columns.length} className="group-header-cell" style={{ padding: "6px 8px" }}>
                    <div className={`group-header-pill ${className}`}>
                      <span className="group-header-pill-icon">{icon}</span>
                      <span className="group-header-pill-text">{row.values[0]}</span>
                    </div>
                  </td>
                </tr>
              );
            }

            // Regular data row
            let rowClass = "row-neutral";
            if (row.netChange !== null) {
              if (row.netChange > 0) rowClass = "row-positive";
              else if (row.netChange < 0) rowClass = "row-negative";
            }

            return (
              <tr key={rowIdx} className={rowClass}>
                {row.values.map((val, colIdx) => {
                  const flashKey = `${rowIdx}-${colIdx}`;
                  const flash = flashCells.get(flashKey);
                  let flashClass = "";
                  if (flash === "green") flashClass = "cell-flash-green";
                  else if (flash === "red") flashClass = "cell-flash-red";
                  else if (flash === "neutral") flashClass = "cell-flash";

                  // Parse cell style from raw ASP.NET styling metadata
                  const cellStatus = row.cellStates?.[colIdx] || "neutral";
                  let cellStyle: React.CSSProperties = {};
                  let cellClassName = flashClass;

                  if (cellStatus === "up") {
                    cellStyle = { color: "var(--rate-positive)", fontWeight: 600 };
                  } else if (cellStatus === "down") {
                    cellStyle = { color: "var(--rate-negative)", fontWeight: 600 };
                  } else if (cellStatus === "bg-up") {
                    cellClassName = `${flashClass} cell-bg-positive`;
                  } else if (cellStatus === "bg-down") {
                    cellClassName = `${flashClass} cell-bg-negative`;
                  }

                  // Render NetChange column with badge and arrow on the right
                  if (colIdx === netCol && row.netChange !== null) {
                    const badgeClass =
                      row.netChange > 0
                        ? "positive"
                        : row.netChange < 0
                        ? "negative"
                        : "neutral";
                    const arrow =
                      row.netChange > 0
                        ? "↑"
                        : row.netChange < 0
                        ? "↓"
                        : "–";

                    return (
                      <td key={colIdx} className={cellClassName} style={cellStyle}>
                        <span className={`change-badge ${badgeClass}`}>
                          {val} {arrow}
                        </span>
                      </td>
                    );
                  }

                  // ItemName column (first column) — bolder
                  if (colIdx === 0) {
                    return (
                      <td key={colIdx} className={`item-name-cell ${cellClassName}`} style={{ fontWeight: 700, ...cellStyle }}>
                        {val}
                      </td>
                    );
                  }

                  // High column — always green in screenshot
                  if (columns[colIdx] === "High" && cellStatus === "neutral" && val.trim() !== "" && val !== "0.00") {
                    return (
                      <td key={colIdx} className={cellClassName} style={{ color: "var(--rate-positive)", fontWeight: 600, ...cellStyle }}>
                        {val}
                      </td>
                    );
                  }

                  // LTP column (second column) — larger, bolder
                  if (colIdx === 1) {
                    return (
                      <td key={colIdx} className={`ltp-cell ${cellClassName}`} style={cellStyle}>
                        {val}
                      </td>
                    );
                  }

                  return (
                    <td key={colIdx} className={cellClassName} style={cellStyle}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
