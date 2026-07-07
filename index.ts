// index.ts
import { Database } from "bun:sqlite";

// --- Configuration ---
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DATABASE = "./metronome.db",
  APP_LPORT = "3000",
  DEBUG = "false",
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  console.error("❌ Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET in .env");
  process.exit(1);
}

// --- Database Setup ---
const db = new Database(DATABASE);
db.exec("PRAGMA journal_mode = WAL;"); 

const schema = await Bun.file("./schema.sql").text();
db.exec(schema);

const upsertUserStmt = db.prepare(`
  INSERT INTO discord_users (user_id, username, global_name, avatar, locale, email, bpm)
  VALUES ($user_id, $username, $global_name, $avatar, $locale, $email, 90)
  ON CONFLICT(user_id) DO UPDATE SET
    username = $username, global_name = $global_name, avatar = $avatar, email = $email
`);

const getUserStmt = db.prepare("SELECT * FROM discord_users WHERE user_id = $user_id");
const updateBpmStmt = db.prepare("UPDATE discord_users SET bpm = $bpm WHERE user_id = $user_id");

// Cache & render HTML template
let indexHtml = await Bun.file("./metronome-frontend/dist/metronome-frontend/browser/index.html").text();
const renderedIndex = indexHtml.replace(/\{\{\s*client_id\s*\}\}/g, DISCORD_CLIENT_ID);

const STATIC_FILES = [
  { pattern: "/favicon.ico", path: "./static/favicon.ico", mime: "image/x-icon" },
  { pattern: "/privacy", path: "./static/privacy.html", mime: "text/html; charset=utf-8" },
  { pattern: "/terms", path: "./static/terms.html", mime: "text/html; charset=utf-8" },
] as const;
// Simple helper for extension-based MIME + wildcard support
function getStaticFileConfig(pathname: string) {
  const exact = STATIC_FILES.find(item => item.pattern === pathname);
  if (exact) return exact;
  if (pathname.endsWith(".css")) {
    return { path: `./metronome-frontend/dist/metronome-frontend/browser${pathname}`, mime: "text/css; charset=utf-8" };
  }
  if (pathname.endsWith(".js")) {
    return { path: `./metronome-frontend/dist/metronome-frontend/browser${pathname}`, mime: "application/javascript; charset=utf-8" };
  }
  return null;
}

// --- HTTP Server ---
const server = Bun.serve({
  port: Number(APP_LPORT),
  development: DEBUG === "true",
  async fetch(req) {
    const url = new URL(req.url);
    //console.log(url);
    const { pathname, searchParams } = url;
    const method = req.method;

    try {
    if (method === "GET") {
        const config = getStaticFileConfig(pathname);
        if (config) {
          const file = Bun.file(config.path);
          if (await file.exists()) {
            return new Response(file, {
              headers: {
                "Content-Type": config.mime,
                "Cache-Control": "public, max-age=3600000, immutable",
              },
            });
          }
        }
      }
      // 2️⃣ GET /
      if (pathname === "/" && method === "GET") {
        return new Response(renderedIndex, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      // 3️⃣ POST /api/token
      if (pathname === "/api/token" && method === "POST") {
        const body = await req.json();
        const code = body?.code;
        if (!code) return Response.json({ error: "Missing code" }, { status: 400 });

        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID!,
            client_secret: DISCORD_CLIENT_SECRET!,
            grant_type: "authorization_code",
            code,
            redirect_uri: body?.redirect_uri || "http://127.0.0.1:3000", // ⚠️ Add if needed
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
          console.error("❌ Discord token exchange failed:", tokenData);
          return Response.json({ error: "Failed to exchange token" }, { status: 400 });
        }

        const userRes = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (userRes.ok) {
          const u = await userRes.json();
          upsertUserStmt.run({
            $user_id: u.id,
            $username: u.username,
            $global_name: u.global_name || "",
            $avatar: u.avatar || "",
            $locale: u.locale || "en",
            $email: u.email || "",
          });
          console.log(`👤 User profile recorded/updated in database: ${u.username} (ID: ${u.id})`);
        }

        return Response.json(tokenData);
      }

      // 4️⃣ GET /api/user
      if (pathname === "/api/user" && method === "GET") {
        const userId = searchParams.get("user_id");
        if (!userId) return Response.json({ error: "Missing user_id" }, { status: 400 });

        const user = getUserStmt.get({ $user_id: userId });
        if (!user) return Response.json({ error: "User not found" }, { status: 404 });
        return Response.json(user);
      }

      // 5️⃣ POST /update_user_prefs
      if (pathname === "/update_user_prefs" && method === "POST") {
        const formData = await req.formData();
        const userId = formData.get("user_id") as string;
        const bpmStr = formData.get("bpm") as string;

        if (!userId || !bpmStr) {
          return Response.json({ error: "Missing user_id or bpm" }, { status: 400 });
        }

        const bpm = Number(bpmStr);
        if (!Number.isInteger(bpm)) {
          return Response.json({ error: "Invalid bpm format" }, { status: 400 });
        }

        updateBpmStmt.run({ $bpm: bpm, $user_id: userId });
        return Response.json({ success: true });
      }

      // 6️⃣ 404 Fallback
      return new Response("Not Found", { status: 404 });

    } catch (error) {
      console.error(`[${method} ${pathname}] Error:`, error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  },
});

console.log(`🚀 Metronome app running at http://127.0.0.1:${server.port}`);
