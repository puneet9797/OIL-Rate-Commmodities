"use client";

import { useState } from "react";
import { RateRow } from "@/types";

interface CommoditiesChartProps {
  columns: string[];
  rows: RateRow[];
}

export default function CommoditiesChart({ columns, rows }: CommoditiesChartProps) {
  const [metric, setMetric] = useState<"ltp" | "netChange">("ltp");
  const [hoveredBar, setHoveredBar] = useState<{
    name: string;
    value: number;
    netChange: number | null;
    ltp: number;
    x: number;
    y: number;
  } | null>(null);

  // Filter out category group headers
  const dataRows = rows.filter((row) => {
    const filledCount = row.values.filter((v) => v.trim() !== "").length;
    return filledCount > 2 || row.netChange !== null;
  });

  if (dataRows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📈</div>
        <div className="empty-title">No Chart Data Available</div>
        <div className="empty-desc">
          Ensure connection is active and rates are loading to display analytics.
        </div>
      </div>
    );
  }

  // Find index of LTP in columns
  const ltpIdx = columns.findIndex((c) => c.toLowerCase() === "ltp");
  const nameIdx = 0;

  // Prepare chart items
  const items = dataRows.map((row) => {
    const name = row.values[nameIdx] || "";
    const ltp = parseFloat(row.values[ltpIdx]) || 0;
    const netChange = row.netChange;
    const value = metric === "ltp" ? ltp : netChange || 0;

    return { name, ltp, netChange, value };
  });

  // Calculate scaling bounds
  const values = items.map((item) => item.value);
  const maxVal = Math.max(...values, 0.1);
  const minVal = Math.min(...values, 0);

  // Chart dimensions
  const width = 1000;
  const height = 400;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 60;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // X and Y scaling helpers
  const getX = (index: number) => {
    return paddingLeft + (index / items.length) * chartWidth;
  };

  const barWidth = Math.max(2, (chartWidth / items.length) * 0.7);

  const getY = (val: number) => {
    // If showing LTP (all positive)
    if (metric === "ltp") {
      const scale = chartHeight / maxVal;
      return paddingTop + chartHeight - val * scale;
    } else {
      // If showing Net Change (positive & negative values)
      const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal), 1);
      const zeroY = paddingTop + chartHeight / 2;
      const scale = (chartHeight / 2) / absMax;
      return zeroY - val * scale;
    }
  };

  const zeroYLine = getY(0);

  return (
    <div className="glass-card fade-in" style={{ position: "relative" }}>
      {/* Chart Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Commodities Market Comparison
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Visual comparison of Last Traded Price (LTP) and Net Change values
          </p>
        </div>

        <div className="export-toolbar">
          <button
            className={`btn ${metric === "ltp" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMetric("ltp")}
          >
            LTP (Price)
          </button>
          <button
            className={`btn ${metric === "netChange" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMetric("netChange")}
          >
            Net Change
          </button>
        </div>
      </div>

      {/* SVG Rendering */}
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          style={{ minWidth: "800px", overflow: "visible" }}
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="green-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="red-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {metric === "ltp" ? (
            <>
              {/* Y Axis Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const val = ratio * maxVal;
                const y = getY(val);
                return (
                  <g key={ratio}>
                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4" opacity="0.15" />
                    <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-mono)" fontWeight="600">
                      {val.toFixed(0)}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {/* Y Axis Grid Lines for positive and negative values */}
              {[-1, -0.5, 0, 0.5, 1].map((ratio) => {
                const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal), 1);
                const val = ratio * absMax;
                const y = getY(val);
                return (
                  <g key={ratio}>
                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke={ratio === 0 ? "var(--text-primary)" : "var(--text-muted)"} strokeWidth={ratio === 0 ? "1.5" : "1"} strokeDasharray={ratio === 0 ? "0" : "4"} opacity={ratio === 0 ? "0.4" : "0.15"} />
                    <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-mono)" fontWeight="600">
                      {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* Bar elements */}
          {items.map((item, idx) => {
            const x = getX(idx) + (chartWidth / items.length - barWidth) / 2;
            const y = getY(item.value);

            let barHeight = 0;
            let barY = y;
            let fillClass = "bar-neutral";

            if (metric === "ltp") {
              barHeight = getY(0) - y;
            } else {
              if (item.value >= 0) {
                barHeight = zeroYLine - y;
                fillClass = "bar-positive";
              } else {
                barHeight = y - zeroYLine;
                barY = zeroYLine;
                fillClass = "bar-negative";
              }
            }

            // Fallback for extremely small bars
            barHeight = Math.max(barHeight, 2);

            return (
              <g
                key={idx}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredBar({
                    name: item.name,
                    value: item.value,
                    netChange: item.netChange,
                    ltp: item.ltp,
                    x: x + barWidth / 2,
                    y: barY - 10,
                  });
                }}
                onMouseLeave={() => setHoveredBar(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Visual bar gradient */}
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  className={`chart-bar ${fillClass}`}
                />

                {/* X axis labels (Rotated for space) */}
                <text
                  x={x + barWidth / 2}
                  y={height - paddingBottom + 15}
                  transform={`rotate(45, ${x + barWidth / 2}, ${height - paddingBottom + 15})`}
                  fill="var(--text-secondary)"
                  fontSize="9.5"
                  fontWeight="500"
                  textAnchor="start"
                >
                  {item.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Card */}
        {hoveredBar && (
          <div
            className="glass-card"
            style={{
              position: "absolute",
              left: `${(hoveredBar.x / width) * 100}%`,
              top: `${(hoveredBar.y / height) * 100 - 15}%`,
              transform: "translate(-50%, -100%)",
              zIndex: 50,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              pointerEvents: "none",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border-medium)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: "150px",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>
              {hoveredBar.name}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
                marginTop: "4px",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>LTP:</span>
              <span style={{ fontWeight: 600 }}>{hoveredBar.ltp.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Net Change:</span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    hoveredBar.netChange !== null && hoveredBar.netChange > 0
                      ? "var(--rate-positive)"
                      : hoveredBar.netChange !== null && hoveredBar.netChange < 0
                      ? "var(--rate-negative)"
                      : "var(--text-muted)",
                }}
              >
                {hoveredBar.netChange !== null
                  ? `${hoveredBar.netChange > 0 ? "+" : ""}${hoveredBar.netChange.toFixed(2)}`
                  : "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
