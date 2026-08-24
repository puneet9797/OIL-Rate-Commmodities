import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const IS_VERCEL = !!process.env.VERCEL;
const BASE_DIR = IS_VERCEL ? "/tmp" : process.cwd();

const SETTINGS_FILE_TMP = path.join(BASE_DIR, "settings.json");
const SETTINGS_FILE_VAR = path.join(process.cwd(), "settings.json");

async function readSettings() {
  try {
    const dataTmp = await fs.readFile(SETTINGS_FILE_TMP, "utf-8");
    const settingsTmp = JSON.parse(dataTmp);

    // Sync check: if defaults changed in code, overwrite /tmp cache
    try {
      const dataVar = await fs.readFile(SETTINGS_FILE_VAR, "utf-8");
      const settingsVar = JSON.parse(dataVar);
      if (settingsTmp.username !== settingsVar.username || settingsTmp.password !== settingsVar.password) {
        await fs.writeFile(SETTINGS_FILE_TMP, JSON.stringify(settingsVar, null, 2), "utf-8");
        return settingsVar;
      }
    } catch {
      // Ignore
    }

    return settingsTmp;
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

export async function GET() {
  try {
    const settings = await readSettings();
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

    await fs.writeFile(SETTINGS_FILE_TMP, JSON.stringify(newSettings, null, 2), "utf-8");
    return NextResponse.json({ success: true, data: newSettings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
