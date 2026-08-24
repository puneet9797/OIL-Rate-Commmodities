const base = "http://173.212.235.147/web/OIL/DetailView/";
const username = "anurag21";
const password = "anurag21";
const theme = "WhiteGreen";
const dataPagePath = "ViewInfoMobile.aspx";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

function extractHiddenField(html, name) {
  const match = html.match(new RegExp(`id="${name}"\\s+value="([^"]*)"`)) ||
                html.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`)) ||
                html.match(new RegExp(`value="([^"]*)"\\s+id="${name}"`)) ||
                html.match(new RegExp(`value="([^"]*)"\\s+name="${name}"`));
  return match ? match[1] : null;
}

function mergeCookies(existing, responseHeaders) {
  const cookies = responseHeaders.get("set-cookie");
  if (!cookies) return existing;
  
  let cookieMap = new Map();
  if (existing) {
    existing.split(";").forEach(c => {
      const parts = c.trim().split("=");
      if (parts[0]) cookieMap.set(parts[0], parts.slice(1).join("="));
    });
  }
  
  cookies.split(/,(?=[^;]*=)/).forEach(c => {
    const parts = c.split(";")[0].trim().split("=");
    if (parts[0]) cookieMap.set(parts[0], parts.slice(1).join("="));
  });
  
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function testConnection() {
  console.log("=== Testing Connection with correct form keys ===");
  try {
    let cookie = "";
    
    async function fetchWithCookies(url, opts) {
      let currentUrl = url;
      let res = await fetch(currentUrl, { ...opts, redirect: "manual" });
      cookie = mergeCookies(cookie, res.headers);
      let hops = 0;
      while (res.status >= 300 && res.status < 400 && hops < 10) {
        const loc = res.headers.get("location");
        if (!loc) break;
        currentUrl = new URL(loc, currentUrl).href;
        res = await fetch(currentUrl, {
          method: "GET",
          headers: { "User-Agent": UA, Cookie: cookie },
          redirect: "manual"
        });
        cookie = mergeCookies(cookie, res.headers);
        hops++;
      }
      const body = await res.text();
      return { res, body, finalUrl: currentUrl };
    }

    const loginPageUrl = base + "ClientLogin.aspx";
    const { res: loginPageRes, body: loginHtml } = await fetchWithCookies(loginPageUrl, { method: "GET", headers: { "User-Agent": UA } });
    
    const viewState = extractHiddenField(loginHtml, "__VIEWSTATE");
    const eventValidation = extractHiddenField(loginHtml, "__EVENTVALIDATION");
    const viewStateGenerator = extractHiddenField(loginHtml, "__VIEWSTATEGENERATOR");

    const params = new URLSearchParams();
    params.append("__VIEWSTATE", viewState);
    if (eventValidation) params.append("__EVENTVALIDATION", eventValidation);
    if (viewStateGenerator) params.append("__VIEWSTATEGENERATOR", viewStateGenerator);
    params.append("txtuname", username); // Correct field!
    params.append("txtpword", password); // Correct field!
    params.append("cmdsubmit", "Sign In"); // Correct field!

    const { res: postLoginRes, finalUrl: postLoginFinalUrl } = await fetchWithCookies(loginPageUrl, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie
      },
      body: params.toString()
    });

    console.log("Post login status:", postLoginRes.status, "finalUrl:", postLoginFinalUrl);

    console.log("Fetching rates data page...");
    const dataUrl = `${base}${dataPagePath}?username=${encodeURIComponent(username)}&Theme=${encodeURIComponent(theme)}`;
    const { res: dataRes, body: dataHtml, finalUrl: dataFinalUrl } = await fetchWithCookies(dataUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Cookie: cookie }
    });

    console.log("Rates page status:", dataRes.status, "finalUrl:", dataFinalUrl);
    const ratesViewState = extractHiddenField(dataHtml, "__VIEWSTATE");
    console.log("Rates page viewstate found:", !!ratesViewState);
    
    if (ratesViewState) {
      console.log("✅ Success! Logged in successfully!");
    } else {
      console.log("❌ Failed to log in.");
    }
  } catch (err) {
    console.error("Test error:", err.message);
  }
}

testConnection();
