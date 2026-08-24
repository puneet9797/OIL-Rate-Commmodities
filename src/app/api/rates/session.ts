/**
 * Server-side session manager for the ASP.NET rate portal.
 * Maintains cookies + viewstate in memory keyed by baseUrl+username.
 */

interface Session {
  cookie: string;
  viewState: string;
  viewGen: string;
  loggedIn: boolean;
  lastUsed: number;
}

const sessions = new Map<string, Session>();

// Clean up stale sessions older than 30 minutes
const SESSION_TTL = 30 * 60 * 1000;

function cleanStale() {
  const now = Date.now();
  for (const [key, sess] of sessions) {
    if (now - sess.lastUsed > SESSION_TTL) {
      sessions.delete(key);
    }
  }
}

export function getSession(key: string): Session | undefined {
  cleanStale();
  const s = sessions.get(key);
  if (s) s.lastUsed = Date.now();
  return s;
}

export function setSession(key: string, session: Partial<Session>) {
  const existing = sessions.get(key) || {
    cookie: "",
    viewState: "",
    viewGen: "",
    loggedIn: false,
    lastUsed: Date.now(),
  };
  sessions.set(key, { ...existing, ...session, lastUsed: Date.now() });
}

export function clearSession(key: string) {
  sessions.delete(key);
}

export function sessionKey(
  baseUrl: string,
  username: string,
  theme?: string
): string {
  return `${baseUrl}::${username}::${theme || "WhiteGreen"}`;
}

/**
 * Parse Set-Cookie headers from the response and merge them into the
 * existing cookie string.
 */
export function mergeCookies(
  existing: string,
  headers: Headers
): string {
  const setCookies: string[] = [];

  // Headers.getSetCookie() is the standard way in modern Node
  if (typeof headers.getSetCookie === "function") {
    setCookies.push(...headers.getSetCookie());
  } else {
    // Fallback: try raw header
    const raw = headers.get("set-cookie");
    if (raw) {
      // Multiple set-cookie values are comma-separated in raw
      setCookies.push(...raw.split(/,(?=\s*\w+=)/));
    }
  }

  let cookieMap = new Map<string, string>();

  // Parse existing cookies
  if (existing) {
    for (const part of existing.split("; ")) {
      const eq = part.indexOf("=");
      if (eq > 0) {
        cookieMap.set(part.substring(0, eq), part);
      }
    }
  }

  // Merge new cookies
  for (const sc of setCookies) {
    const kv = sc.split(";")[0].trim();
    const eq = kv.indexOf("=");
    if (eq > 0) {
      const name = kv.substring(0, eq);
      cookieMap.set(name, kv);
    }
  }

  return Array.from(cookieMap.values()).join("; ");
}

/**
 * Extract a hidden field value from HTML (e.g. __VIEWSTATE).
 */
export function extractHiddenField(
  html: string,
  fieldName: string
): string {
  // Look for id="fieldName" ... value="..."
  const patterns = [
    new RegExp(
      `id="${fieldName}"[^>]*value="([^"]*)"`,
      "i"
    ),
    new RegExp(
      `name="${fieldName}"[^>]*value="([^"]*)"`,
      "i"
    ),
  ];

  for (const pat of patterns) {
    const m = html.match(pat);
    if (m && m[1]) {
      return htmlDecode(m[1]);
    }
  }
  return "";
}

/**
 * Extract a field from ASP.NET AJAX delta response.
 * Format: ...|hiddenField|__VIEWSTATE|<value>|...
 */
export function extractDeltaField(
  response: string,
  fieldName: string
): string {
  const tag = `|hiddenField|${fieldName}|`;
  const p = response.indexOf(tag);
  if (p < 0) return "";
  const start = p + tag.length;
  const end = response.indexOf("|", start);
  if (end < 0) return "";
  return response.substring(start, end);
}

function htmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
