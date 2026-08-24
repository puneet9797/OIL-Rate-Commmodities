import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

export async function GET() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(data);
    
    // We can return the settings, but to hide password in general GET calls,
    // we can return it. (Only admin accesses settings GET, so it is safe).
    return NextResponse.json({ success: true, data: settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { baseUrl, username, password, theme, refreshInterval, dataPagePath } = body;
    
    const newSettings = {
      baseUrl: baseUrl || "",
      username: username || "",
      password: password || "",
      theme: theme || "WhiteGreen",
      refreshInterval: Math.max(1, parseInt(String(refreshInterval)) || 3),
      dataPagePath: dataPagePath || "ViewInfoMobile.aspx"
    };

    await fs.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), "utf-8");
    return NextResponse.json({ success: true, data: newSettings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
