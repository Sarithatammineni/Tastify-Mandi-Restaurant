// Local preview server: runs the real worker.js against a real SQLite database
// (same SQL dialect as Cloudflare D1) and serves the site's static files.
//   node .freebuff/dev-server.mjs [port]
// Local only. Production uses D1 + the OWNER_USERNAME / OWNER_PASSWORD secrets.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || 8377);
const DB_FILE = path.join(ROOT, ".freebuff", "dev.db");

/* ---------- D1 shim over node:sqlite ---------- */
const sqlite = new DatabaseSync(DB_FILE);

class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql, args); }
  async first() {
    try {
      return sqlite.prepare(this.sql).get(...this.args) ?? null;
    } catch (err) {
      if (/no such table/i.test(err.message)) return null;
      throw err;
    }
  }
  async all() {
    try {
      return { results: sqlite.prepare(this.sql).all(...this.args) };
    } catch (err) {
      if (/no such table/i.test(err.message)) return { results: [] };
      throw err;
    }
  }
  async run() {
    const info = sqlite.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: info.changes } };
  }
}

const DB = {
  prepare: (sql) => new Statement(sql),
  async batch(list) {
    const out = [];
    for (const s of list) out.push(await s.run());
    return out;
  },
};

/* ---------- Static assets ---------- */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const ASSETS = {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
    try {
      const body = fs.readFileSync(file);
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    } catch {
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    }
  },
};

/* ---------- Worker with the menu seed inlined ---------- */
const seedSource = fs.readFileSync(path.join(ROOT, "menu-seed.js"), "utf8");
const { MENU_SEED, CATEGORIES } = new Function(
  seedSource
    .replace("export const CATEGORIES =", "const CATEGORIES =")
    .replace("export default [", "const MENU_SEED = [") +
    "\nreturn { MENU_SEED, CATEGORIES };"
)();

const workerSource = fs
  .readFileSync(path.join(ROOT, "worker.js"), "utf8")
  .replace(
    /^import .*menu-seed\.js.*$/m,
    `const MENU_SEED = ${JSON.stringify(MENU_SEED)};\nconst CATEGORIES = ${JSON.stringify(CATEGORIES)};`
  );

const worker = (
  await import("data:text/javascript;base64," + Buffer.from(workerSource).toString("base64"))
).default;

const env = {
  ASSETS,
  DB,
  // Local development credentials only — never used in production.
  OWNER_USERNAME: process.env.OWNER_USERNAME || "owner",
  OWNER_PASSWORD: process.env.OWNER_PASSWORD || "tastify123",
  SESSION_SECRET: process.env.SESSION_SECRET || "local-dev-secret",
};

/* ---------- HTTP ---------- */
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const init = { method: req.method, headers: req.headers };
    if (chunks.length) init.body = Buffer.concat(chunks);

    const response = await worker.fetch(new Request(url, init), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error("request failed:", err);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("local server error: " + err.message);
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Tastify local server → http://127.0.0.1:${PORT}/index.html`);
  console.log(`database file: ${DB_FILE}`);
  console.log(`owner login: ${env.OWNER_USERNAME} / ${env.OWNER_PASSWORD} (local only)`);
});
