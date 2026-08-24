/* Shared types for the Live Rates application */

export interface RateRow {
  values: string[];
  netChange: number | null;
  cellStates?: ("neutral" | "up" | "down" | "bg-up" | "bg-down")[];
}

export interface RatesData {
  columns: string[];
  rows: RateRow[];
  timestamp: string;
  rowCount: number;
}

export interface AppSettings {
  baseUrl: string;
  username: string;
  password: string;
  theme: string;
  refreshInterval: number;
  dataPagePath: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: "http://173.212.235.147/web/OIL/DetailView/",
  username: "satyam70",
  password: "satyam70",
  theme: "WhiteGreen",
  refreshInterval: 3,
  dataPagePath: "ViewInfoMobile.aspx",
};

export interface ApiResponse {
  success: boolean;
  data?: RatesData;
  error?: string;
}
