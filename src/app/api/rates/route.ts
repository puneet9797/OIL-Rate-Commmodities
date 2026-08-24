import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import {
  getSession,
  setSession,
  clearSession,
  sessionKey,
  mergeCookies,
  extractHiddenField,
  extractDeltaField,
} from "./session";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

const IS_VERCEL = !!process.env.VERCEL;
const BASE_DIR = IS_VERCEL ? "/tmp" : process.cwd();

const SETTINGS_FILE_TMP = path.join(BASE_DIR, "settings.json");
const SETTINGS_FILE_VAR = path.join(process.cwd(), "settings.json");

async function readSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE_TMP, "utf-8");
    return JSON.parse(data);
  } catch {
    try {
      const data = await fs.readFile(SETTINGS_FILE_VAR, "utf-8");
      const settings = JSON.parse(data);
      // Cache settings file in the writeable directory
      await fs.writeFile(SETTINGS_FILE_TMP, JSON.stringify(settings, null, 2), "utf-8");
      return settings;
    } catch {
      return {};
    }
  }
}

/**
 * POST /api/rates
 *
 * Acts as a server-side proxy:
 *  1. Load baseUrl, username, password from settings.json (Server-side)
 *  2. Login to ClientLogin.aspx (if not already logged in)
 *  3. GET the data page to capture __VIEWSTATE
 *  4. POST the Timer1 AJAX request for rate data
 *  5. Parse the HTML table and return clean JSON
 */
export async function POST(request: NextRequest) {
  try {
    let baseUrl = "";
    let username = "";
    let password = "";
    let theme = "WhiteGreen";
    let dataPagePath = "ViewInfoMobile.aspx";

    // Try loading server-side configuration first
    try {
      const settings = await readSettings();
      baseUrl = settings.baseUrl;
      username = settings.username;
      password = settings.password;
      theme = settings.theme;
      dataPagePath = settings.dataPagePath;
    } catch {
      // Fallback to request body if settings.json not found
      try {
        const body = await request.json();
        baseUrl = body.baseUrl;
        username = body.username;
        password = body.password;
        theme = body.theme || "WhiteGreen";
        dataPagePath = body.dataPagePath || "ViewInfoMobile.aspx";
      } catch {
        // Ignore
      }
    }

    if (!baseUrl || !username || !password) {
      return NextResponse.json(
        { success: false, error: "Missing API credentials on server. Please configure settings first." },
        { status: 400 }
      );
    }

    const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    const dataUrl = `${base}${dataPagePath}?username=${encodeURIComponent(
      username
    )}&Theme=${encodeURIComponent(theme)}`;

    const key = sessionKey(base, username, theme);
    let sess = getSession(key);

    // ── Login + grab viewstate if not already done ───────────
    if (!sess || !sess.loggedIn || !sess.viewState) {
      const loginResult = await doLogin(base, username, password, dataUrl, key);
      if (!loginResult.success) {
        return NextResponse.json(
          { success: false, error: loginResult.error },
          { status: 401 }
        );
      }
      sess = getSession(key)!;
    }

    // ── Timer1 AJAX POST for rates ──────────────────────────
    let resp = await doAjaxPost(dataUrl, sess);
    
    // Parse HTML table to verify rows
    const htmlStartFirst = resp.indexOf("<");
    const htmlFirst = htmlStartFirst > 0 ? resp.substring(htmlStartFirst) : resp;
    let parsed = parseTable(htmlFirst);

    // If no valid data rows found, session may have expired — retry login
    if (parsed.rowCount <= 1) {
      clearSession(key);
      const loginResult = await doLogin(base, username, password, dataUrl, key);
      if (!loginResult.success) {
        return NextResponse.json(
          { success: false, error: loginResult.error },
          { status: 401 }
        );
      }
      sess = getSession(key)!;
      resp = await doAjaxPost(dataUrl, sess);
      
      const htmlStartSecond = resp.indexOf("<");
      const htmlSecond = htmlStartSecond > 0 ? resp.substring(htmlStartSecond) : resp;
      parsed = parseTable(htmlSecond);

      if (parsed.rowCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No rate data rows found in response. The session might be blocked or credentials invalid.",
          },
          { status: 502 }
        );
      }
    }

    // ── Update viewstate from delta ─────────────────────────
    const newVS = extractDeltaField(resp, "__VIEWSTATE");
    const newVG = extractDeltaField(resp, "__VIEWSTATEGENERATOR");
    if (newVS) setSession(key, { viewState: newVS });
    if (newVG) setSession(key, { viewGen: newVG });

    return NextResponse.json({
      success: true,
      data: {
        ...parsed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("API /rates error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

// ─── Login Flow ─────────────────────────────────────────────────

async function doLogin(
  base: string,
  username: string,
  password: string,
  dataUrl: string,
  key: string
): Promise<{ success: boolean; error?: string }> {
  let cookie = "";

  /**
   * Helper: fetch with manual redirect following so we capture
   * Set-Cookie headers at every 3xx hop.
   */
  async function fetchWithCookies(
    url: string,
    opts: RequestInit & { headers: Record<string, string> }
  ): Promise<{ res: Response; body: string; finalUrl: string }> {
    let currentUrl = url;
    let res = await fetch(currentUrl, { ...opts, redirect: "manual", cache: "no-store" });
    cookie = mergeCookies(cookie, res.headers);

    // Follow redirect chain (max 10 hops)
    let hops = 0;
    while (res.status >= 300 && res.status < 400 && hops < 10) {
      const loc = res.headers.get("location");
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
      res = await fetch(currentUrl, {
        method: "GET",
        headers: { "User-Agent": UA, Cookie: cookie },
        redirect: "manual",
        cache: "no-store",
      });
      cookie = mergeCookies(cookie, res.headers);
      hops++;
    }

    const body = await res.text();
    return { res, body, finalUrl: currentUrl };
  }

  // 1. GET login page
  const loginPageUrl = base + "ClientLogin.aspx";
  const { res: loginPageRes, body: loginHtml } = await fetchWithCookies(
    loginPageUrl,
    { method: "GET", headers: { "User-Agent": UA } }
  );

  if (loginPageRes.status !== 200) {
    return {
      success: false,
      error: `Login page returned ${loginPageRes.status}. Check your Base URL.`,
    };
  }

  // 2. Build login form body
  const loginBody = buildLoginBody(loginHtml, username, password);
  if (!loginBody) {
    return {
      success: false,
      error: "Could not find login form fields. Check your Base URL.",
    };
  }

  // 3. POST login (will 302 → ThemePage.aspx with passCookies)
  await fetchWithCookies(loginPageUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookie,
    },
    body: loginBody,
  });

  // 4. GET data page to capture viewstate
  const { res: dataRes, body: dataHtml, finalUrl: dataFinalUrl } = await fetchWithCookies(dataUrl, {
    method: "GET",
    headers: { "User-Agent": UA, Cookie: cookie },
  });

  const viewState = extractHiddenField(dataHtml, "__VIEWSTATE");
  const viewGen = extractHiddenField(dataHtml, "__VIEWSTATEGENERATOR");

  if (!viewState) {
    console.warn("doLogin viewstate check failed. status:", dataRes?.status, "finalUrl:", dataFinalUrl);
    
    // Check if the rate host blocked us
    const lowerHtml = dataHtml.toLowerCase();
    if (dataRes?.status === 403 || lowerHtml.includes("blocked") || lowerHtml.includes("forbidden") || lowerHtml.includes("access denied")) {
      return {
        success: false,
        error: "Access Denied (IP Blocked): The rate feed host is blocking requests from Vercel's US-based servers.",
      };
    }

    return {
      success: false,
      error: "Login failed or viewstate not found. Check username/password or base URL.",
    };
  }

  setSession(key, {
    cookie,
    viewState,
    viewGen,
    loggedIn: true,
  });

  return { success: true };
}

// ─── AJAX Post ──────────────────────────────────────────────────

async function doAjaxPost(
  dataUrl: string,
  sess: { cookie: string; viewState: string; viewGen: string }
): Promise<string> {
  const body = [
    `ScriptManager1=${encodeURIComponent("ScriptManager1|Timer1")}`,
    `__EVENTTARGET=Timer1`,
    `__EVENTARGUMENT=`,
    `__VIEWSTATE=${encodeURIComponent(sess.viewState)}`,
    `__VIEWSTATEGENERATOR=${encodeURIComponent(sess.viewGen)}`,
    `__ASYNCPOST=true`,
  ].join("&");

  const res = await fetch(dataUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: sess.cookie,
      "X-MicrosoftAjax": "Delta=true",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
    redirect: "follow",
    cache: "no-store",
  });

  return await res.text();
}

// ─── Build Login Body ───────────────────────────────────────────

function buildLoginBody(
  html: string,
  username: string,
  password: string
): string {
  const $ = cheerio.load(html);
  const parts: string[] = [];
  let submitDone = false;

  $("input").each((_, el) => {
    const name = $(el).attr("name");
    const type = ($(el).attr("type") || "").toLowerCase();
    const value = $(el).attr("value") || "";

    if (!name) return;

    switch (type) {
      case "hidden":
        parts.push(
          `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
        );
        break;
      case "text":
      case "email":
      case "":
        parts.push(
          `${encodeURIComponent(name)}=${encodeURIComponent(username)}`
        );
        break;
      case "password":
        parts.push(
          `${encodeURIComponent(name)}=${encodeURIComponent(password)}`
        );
        break;
      case "submit":
      case "image":
        if (!submitDone) {
          parts.push(
            `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
          );
          submitDone = true;
        }
        break;
    }
  });

  return parts.join("&");
}

// ─── Parse HTML Table ───────────────────────────────────────────

function parseTable(html: string): {
  columns: string[];
  rows: { values: string[]; netChange: number | null }[];
  rowCount: number;
} {
  const $ = cheerio.load(html);
  const tables = $("table");

  // Find the largest table (most rows)
  let bestIdx = -1;
  let maxRows = 0;

  tables.each((idx, table) => {
    const rowCount = $(table).find("tr").length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      bestIdx = idx;
    }
  });

  if (bestIdx < 0 || maxRows < 2) {
    return { columns: [], rows: [], rowCount: 0 };
  }

  const bestTable = $(tables[bestIdx]);
  const allRows = bestTable.find("tr");
  const columns: string[] = [];
  const rows: {
    values: string[];
    netChange: number | null;
    cellStates?: ("neutral" | "up" | "down" | "bg-up" | "bg-down")[];
  }[] = [];

  // Find net change column index
  let netCol = -1;

  allRows.each((i: number, tr: unknown) => {
    const cells = $(tr as string).find("th, td");
    const cellValues: string[] = [];
    const cellStates: ("neutral" | "up" | "down" | "bg-up" | "bg-down")[] = [];

    cells.each((_: number, cell: unknown) => {
      const $cell = $(cell as string);
      const text = $cell.text().replace(/\u00A0/g, " ").replace(/,/g, "").trim();
      cellValues.push(text);

      if (i > 0) {
        // Parse cell colors and styles
        let status: "neutral" | "up" | "down" | "bg-up" | "bg-down" = "neutral";
        const tdStyle = $cell.attr("style") || "";
        
        if (/background-color/i.test(tdStyle)) {
          if (/#FF|red/i.test(tdStyle)) {
            status = "bg-down";
          } else if (/#00|green/i.test(tdStyle)) {
            status = "bg-up";
          }
        } else {
          const spanStyle = $cell.find("span, font").attr("style") || "";
          if (/color:\s*Red|#FF/i.test(spanStyle)) {
            status = "down";
          } else if (/color:\s*Green|#00/i.test(spanStyle) || /color:\s*#059669/i.test(spanStyle) || /color:\s*#22c55e/i.test(spanStyle)) {
            status = "up";
          }
        }
        cellStates.push(status);
      }
    });

    if (i === 0) {
      // Header row
      cellValues.forEach((val, idx) => {
        columns.push(val);
        if (val.toLowerCase().includes("net")) {
          netCol = idx;
        }
      });
    } else {
      // Data row
      let netChange: number | null = null;
      if (netCol >= 0 && netCol < cellValues.length) {
        const numVal = parseFloat(cellValues[netCol]);
        if (!isNaN(numVal)) {
          netChange = numVal;
        }
      }
      rows.push({ values: cellValues, netChange, cellStates });
    }
  });

  return { columns, rows, rowCount: rows.length };
}
