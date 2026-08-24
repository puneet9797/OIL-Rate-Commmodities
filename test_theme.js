// Test table parsing for different Theme parameter values
const cheerio = require("./node_modules/cheerio");

const BASE = "http://173.212.235.147/web/OIL/DetailView/";
const USER = "satyam70";
const PASS = "satyam70";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

function mergeCookies(existing, headers) {
  const setCookies = [];
  if (typeof headers.getSetCookie === "function") {
    setCookies.push(...headers.getSetCookie());
  } else {
    const raw = headers.get("set-cookie");
    if (raw) setCookies.push(...raw.split(/,(?=\s*\w+=)/));
  }
  let cookieMap = new Map();
  if (existing) {
    for (const part of existing.split("; ")) {
      const eq = part.indexOf("=");
      if (eq > 0) cookieMap.set(part.substring(0, eq), part);
    }
  }
  for (const sc of setCookies) {
    const kv = sc.split(";")[0].trim();
    const eq = kv.indexOf("=");
    if (eq > 0) cookieMap.set(kv.substring(0, eq), kv);
  }
  return Array.from(cookieMap.values()).join("; ");
}

function extractField(html, name) {
  const patterns = [
    new RegExp(`id="${name}"[^>]*value="([^"]*)"`, "i"),
    new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1].replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");
  }
  return "";
}

async function testTheme(themeName) {
  console.log(`\n================ TEST THEME: "${themeName}" ================`);
  let cookie = "";

  // 1. GET login page
  const r1 = await fetch(BASE + "ClientLogin.aspx", {
    method: "GET",
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
  cookie = mergeCookies(cookie, r1.headers);

  // follow redirect
  let loginUrl = BASE + "ClientLogin.aspx";
  let loginHtml;
  if (r1.status >= 300 && r1.status < 400) {
    const loc = r1.headers.get("location");
    const r1b = await fetch(new URL(loc, BASE).href, {
      method: "GET",
      headers: { "User-Agent": UA, Cookie: cookie },
      redirect: "manual",
    });
    cookie = mergeCookies(cookie, r1b.headers);
    loginHtml = await r1b.text();
    loginUrl = new URL(loc, BASE).href;
  } else {
    loginHtml = await r1.text();
  }

  // 2. Build login form body
  const inputRegex = /<input[^>]*>/gi;
  const inputs = loginHtml.match(inputRegex) || [];
  const parts = [];
  let submitDone = false;
  for (const inp of inputs) {
    const name = inp.match(/name="([^"]*)"/)?.[1] || "";
    const type = (inp.match(/type="([^"]*)"/)?.[1] || "").toLowerCase();
    const value = inp.match(/value="([^"]*)"/)?.[1] || "";
    if (!name) continue;
    switch (type) {
      case "hidden":
        parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value.replace(/&amp;/g,"&"))}`);
        break;
      case "text": case "email": case "":
        parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(USER)}`);
        break;
      case "password":
        parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(PASS)}`);
        break;
      case "submit": case "image":
        if (!submitDone) {
          parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
          submitDone = true;
        }
        break;
    }
  }
  const loginBody = parts.join("&");

  // 3. POST login
  const r2 = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookie,
    },
    body: loginBody,
    redirect: "manual",
  });
  cookie = mergeCookies(cookie, r2.headers);

  // follow redirect
  let currentUrl = loginUrl;
  let currentRes = r2;
  while (currentRes.status >= 300 && currentRes.status < 400) {
    const loc = currentRes.headers.get("location");
    currentUrl = new URL(loc, currentUrl).href;
    currentRes = await fetch(currentUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Cookie: cookie },
      redirect: "manual",
    });
    cookie = mergeCookies(cookie, currentRes.headers);
  }

  // 4. GET data page with the specified theme name
  const dataUrl = `${BASE}ViewInfoMobile.aspx?username=${encodeURIComponent(USER)}&Theme=${encodeURIComponent(themeName)}`;
  const r3 = await fetch(dataUrl, {
    method: "GET",
    headers: { "User-Agent": UA, Cookie: cookie },
    redirect: "manual",
  });
  cookie = mergeCookies(cookie, r3.headers);

  let dataRes = r3;
  let dataUrlCurrent = dataUrl;
  while (dataRes.status >= 300 && dataRes.status < 400) {
    const loc = dataRes.headers.get("location");
    dataUrlCurrent = new URL(loc, dataUrlCurrent).href;
    dataRes = await fetch(dataUrlCurrent, {
      method: "GET",
      headers: { "User-Agent": UA, Cookie: cookie },
      redirect: "manual",
    });
    cookie = mergeCookies(cookie, dataRes.headers);
  }

  const dataHtml = await dataRes.text();
  const vs = extractField(dataHtml, "__VIEWSTATE");
  const vg = extractField(dataHtml, "__VIEWSTATEGENERATOR");

  // 5. AJAX POST
  const ajaxBody = [
    `ScriptManager1=${encodeURIComponent("ScriptManager1|Timer1")}`,
    `__EVENTTARGET=Timer1`,
    `__EVENTARGUMENT=`,
    `__VIEWSTATE=${encodeURIComponent(vs)}`,
    `__VIEWSTATEGENERATOR=${encodeURIComponent(vg)}`,
    `__ASYNCPOST=true`,
  ].join("&");

  const r4 = await fetch(dataUrlCurrent || dataUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookie,
      "X-MicrosoftAjax": "Delta=true",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: ajaxBody,
    redirect: "follow",
  });

  const ajaxResp = await r4.text();
  const htmlStart = ajaxResp.indexOf("<");
  const html = htmlStart > 0 ? ajaxResp.substring(htmlStart) : ajaxResp;

  const $ = cheerio.load(html);
  const tables = $("table");
  console.log("Number of tables found:", tables.length);

  tables.each((idx, t) => {
    const rows = $(t).find("tr");
    console.log(`Table ${idx}: rows=${rows.length}`);
    rows.slice(0, 3).each((rIdx, r) => {
      const cellTexts = $(r).find("td, th").map((_, c) => $(c).text().trim()).get();
      console.log(`  Row ${rIdx}:`, cellTexts);
    });
  });
}

async function run() {
  await testTheme("WhiteGreen");
  await testTheme("White Green");
}

run().catch(console.error);
