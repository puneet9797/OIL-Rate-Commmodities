import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "users.json");

// Helper to read users list
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper to write users list
async function writeUsers(users: any[]) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password, role } = body;
    const usersList = await readUsers();

    // Decode password from Base64 if encoded to hide from inspect network window
    let decodedPassword = password || "";
    if (password && !password.includes(" ")) {
      try {
        const decoded = Buffer.from(password, "base64").toString("utf-8");
        if (decoded && /^[\x20-\x7E]*$/.test(decoded)) {
          decodedPassword = decoded;
        }
      } catch {
        // Fallback
      }
    }

    if (action === "login") {
      const found = usersList.find(
        (u: any) => u.username === username?.trim() && u.password === decodedPassword
      );

      if (found) {
        return NextResponse.json({
          success: true,
          user: { username: found.username, role: found.role }
        });
      } else {
        return NextResponse.json({ success: false, error: "Invalid credentials" });
      }
    }

    if (action === "list") {
      // Return users without passwords for security in inspector
      const sanitized = usersList.map((u: any) => ({
        username: u.username,
        role: u.role
      }));
      return NextResponse.json({ success: true, users: sanitized });
    }

    if (action === "create") {
      const name = username?.trim();
      if (!name || !decodedPassword) {
        return NextResponse.json({ success: false, error: "Username and password required" });
      }

      if (usersList.some((u: any) => u.username.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ success: false, error: "Username already exists" });
      }

      const updated = [...usersList, { username: name, password: decodedPassword, role: role || "user" }];
      await writeUsers(updated);

      const sanitized = updated.map((u: any) => ({
        username: u.username,
        role: u.role
      }));
      return NextResponse.json({ success: true, users: sanitized });
    }

    if (action === "delete") {
      const name = username?.trim();
      const updated = usersList.filter((u: any) => u.username !== name);
      await writeUsers(updated);

      const sanitized = updated.map((u: any) => ({
        username: u.username,
        role: u.role
      }));
      return NextResponse.json({ success: true, users: sanitized });
    }

    return NextResponse.json({ success: false, error: "Invalid action" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
