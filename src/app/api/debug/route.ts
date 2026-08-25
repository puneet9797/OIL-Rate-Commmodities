import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const preferredRegion = "fra1";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

/**
 * GET /api/debug — Diagnostic endpoint to test connectivity to the rate provider.
 * Returns detailed info about each step of the login flow.
 */
export async function GET() {
  const baseUrl = "http://173.212.235.147/web/OIL/DetailView/";
  const loginUrl = baseUrl + "ClientLogin.aspx";
  const dataUrl = baseUrl + "ViewInfoMobile.aspx?username=anurag21&Theme=WhiteGreen";
  const steps: any[] = [];
  let cookie = "";

  async function fetchWithCookies(
    url: string,
    opts: RequestInit & { headers: Record<string, string> }
  ): Promise<{ res: Response; body: string; finalUrl: string }> {
    let currentUrl = url;
    steps.push({ step: `FETCH START: ${opts.method || "GET"} ${currentUrl}`, headersSent: opts.headers });
    let res = await fetch(currentUrl, { ...opts, redirect: "manual", cache: "no-store" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      steps.push({ step: `SET COOKIE RECEIVED`, value: setCookie });
      // manual merge
      const setCookies = setCookie.split(/,(?=\s*\w+=)/);
      let cookieMap = new Map<string, string>();
      if (cookie) {
        cookie.split("; ").forEach(p => {
          const eq = p.indexOf("=");
          if (eq > 0) cookieMap.set(p.substring(0, eq), p);
        });
      }
      setCookies.forEach(sc => {
        const kv = sc.split(";")[0].trim();
        const eq = kv.indexOf("=");
        if (eq > 0) cookieMap.set(kv.substring(0, eq), kv);
      });
      cookie = Array.from(cookieMap.values()).join("; ");
    }

    steps.push({ step: `FETCH RESPONDED`, status: res.status, headers: Object.fromEntries(res.headers.entries()) });

    // Follow redirect chain
    let hops = 0;
    while (res.status >= 300 && res.status < 400 && hops < 10) {
      const loc = res.headers.get("location");
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
      steps.push({ step: `FETCH REDIRECTING TO: ${currentUrl}`, cookieUsed: cookie });
      res = await fetch(currentUrl, {
        method: "GET",
        headers: { "User-Agent": UA, Cookie: cookie },
        redirect: "manual",
        cache: "no-store",
      });
      
      const sc = res.headers.get("set-cookie");
      if (sc) {
        steps.push({ step: `SET COOKIE RECEIVED (REDIRECT)`, value: sc });
        const setCookies = sc.split(/,(?=\s*\w+=)/);
        let cookieMap = new Map<string, string>();
        if (cookie) {
          cookie.split("; ").forEach(p => {
            const eq = p.indexOf("=");
            if (eq > 0) cookieMap.set(p.substring(0, eq), p);
          });
        }
        setCookies.forEach(scItem => {
          const kv = scItem.split(";")[0].trim();
          const eq = kv.indexOf("=");
          if (eq > 0) cookieMap.set(kv.substring(0, eq), kv);
        });
        cookie = Array.from(cookieMap.values()).join("; ");
      }
      
      steps.push({ step: `FETCH RESPONDED (REDIRECT)`, status: res.status, headers: Object.fromEntries(res.headers.entries()) });
      hops++;
    }

    const body = await res.text();
    return { res, body, finalUrl: currentUrl };
  }

  try {
    // 1. GET login page
    const { body: loginHtml } = await fetchWithCookies(loginUrl, {
      method: "GET",
      headers: { "User-Agent": UA },
    });

    // 2. Build login form body
    const $ = cheerio.load(loginHtml);
    const parts: string[] = [];
    let submitDone = false;
    $("input").each((_, el) => {
      const name = $(el).attr("name");
      const type = ($(el).attr("type") || "").toLowerCase();
      const value = $(el).attr("value") || "";
      if (!name) return;
      switch (type) {
        case "hidden":
          parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
          break;
        case "text":
        case "email":
        case "":
          parts.push(`${encodeURIComponent(name)}=${encodeURIComponent("anurag21")}`);
          break;
        case "password":
          parts.push(`${encodeURIComponent(name)}=${encodeURIComponent("anurag21")}`);
          break;
        case "submit":
        case "image":
          if (!submitDone) {
            parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
            submitDone = true;
          }
          break;
      }
    });
    const loginBody = parts.join("&");

    steps.push({ step: "2. Form Body Built", body: loginBody });

    // 3. POST login
    const { body: postHtml, res: postRes } = await fetchWithCookies(loginUrl, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: cookie,
      },
      body: loginBody,
    });

    const isLoginError = postHtml.includes("Invalid") || postHtml.includes("error") || postHtml.includes("Incorrect");
    const $post = cheerio.load(postHtml);
    const postTitle = $post("title").text().trim();
    
    steps.push({
      step: "3b. POST Response Analysis",
      title: postTitle,
      htmlLength: postHtml.length,
      hasErrorText: isLoginError,
      snippet: postHtml.substring(0, 1500)
    });

    // 4. GET data page to check viewstate
    const { body: dataHtml } = await fetchWithCookies(dataUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Cookie: cookie },
    });

    const viewState = dataHtml.includes("__VIEWSTATE");
    steps.push({
      step: "4. Verify Viewstate Presence",
      viewStateFound: viewState,
      htmlSnippet: dataHtml.substring(0, 1000)
    });

    return NextResponse.json({
      success: true,
      cookieState: cookie,
      steps,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      success: false,
      error: msg,
      steps,
    });
  }
}
