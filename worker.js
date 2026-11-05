/* ============ Tastify — API + static assets ============ */
/* The site is served from env.ASSETS; everything dynamic lives in D1 (env.DB):
     menu_items   the menu (seeded from menu-seed.js on first request)
     settings     today's availability + timestamps
     owner        the owner's username and password hash
   Endpoints:
     GET  /api/menu            menu + availability (public)
     GET  /api/availability    tiny payload the page polls for live updates
     POST /api/login           { username, password } → session token
     GET  /api/session         validates a token stored on the owner's device
     POST /api/availability    { items } (Bearer token) saves today's menu
   Customers never log in; only the owner does, and only on their own device. */

import MENU_SEED, { CATEGORIES } from "./menu-seed.js";

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const NO_STORE = { "cache-control": "no-store" };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    switch (pathname) {
      case "/api/menu":
        if (method === "GET") return getMenu(env);
        break;
      case "/api/availability":
        if (method === "GET") return getAvailability(env);
        if (method === "POST") return saveAvailability(request, env);
        break;
      case "/api/login":
        if (method === "POST") return login(request, env);
        break;
      case "/api/session":
        if (method === "GET") return getSession(request, env);
        break;
      case "/api/health":
        return json({ ok: true, db: !!env.DB, time: new Date().toISOString() });
    }
    if (pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};

/* ---------- Menu ---------- */
async function getMenu(env) {
  if (!env.DB) return json({ source: "bundled", items: MENU_SEED, availability: null, updatedAt: null });
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(
      `SELECT cat, name, veg, price, sizes, prices, note, img
         FROM menu_items ORDER BY ord`
    ).all();
    const items = (results || []).map(rowToItem);
    const settings = await readSettings(env);
    return json({
      source: "db",
      items: items.length ? items : MENU_SEED,
      categories: CATEGORIES,
      availability: settings.items,
      updatedAt: settings.updatedAt,
    });
  } catch {
    // A database problem must never take the menu offline.
    return json({ source: "bundled", items: MENU_SEED, availability: null, updatedAt: null });
  }
}

/* ---------- Availability ---------- */
async function getAvailability(env) {
  if (!env.DB) return json({ configured: false, items: null, updatedAt: null });
  try {
    await ensureSchema(env);
    const settings = await readSettings(env);
    return json({ configured: true, items: settings.items, updatedAt: settings.updatedAt });
  } catch {
    return json({ configured: true, items: null, updatedAt: null, readError: true });
  }
}

async function saveAvailability(request, env) {
  if (!env.DB) return json({ error: "storage_not_configured" }, 503);
  const auth = await requireOwner(request, env);
  if (auth.error) return auth.error;

  const body = await readJson(request);
  if (!body) return json({ error: "bad_request" }, 400);
  const items = parseItems(body.items);
  if (items === undefined) return json({ error: "bad_items" }, 400);

  try {
    await ensureSchema(env);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('availability', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(items ? JSON.stringify(items) : "null", now).run();
    return json({ ok: true, items, updatedAt: now, by: auth.username });
  } catch {
    return json({ error: "storage_write_failed" }, 500);
  }
}

/* ---------- Owner login ---------- */
async function login(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "bad_request" }, 400);
  if (!env.DB) return json({ error: "storage_not_configured" }, 503);

  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) return json({ error: "missing_credentials" }, 400);

  try {
    await ensureSchema(env);
    const owner = await loadOwner(env);
    if (!owner) return json({ error: "owner_not_configured" }, 503);

    const hash = await hashPassword(password, owner.salt, owner.iterations);
    const usernameOk = safeEqual(username, owner.username);
    const passwordOk = safeEqual(hash, owner.hash);
    if (!usernameOk || !passwordOk) {
      await pause(400); // slow down guessing
      return json({ error: "wrong_credentials" }, 401);
    }

    const { token, expiresAt } = await issueToken(env, owner);
    return json({ ok: true, username: owner.username, token, expiresAt });
  } catch {
    return json({ error: "login_failed" }, 500);
  }
}

async function getSession(request, env) {
  if (!env.DB) return json({ error: "storage_not_configured" }, 503);
  const auth = await requireOwner(request, env);
  if (auth.error) return auth.error;
  return json({ ok: true, username: auth.username });
}

async function loadOwner(env) {
  let row = await env.DB.prepare(
    "SELECT username, salt, hash, iterations FROM owner WHERE id = 1"
  ).first();
  if (row) return row;

  // First run: create the account from the OWNER_USERNAME / OWNER_PASSWORD secrets.
  const username = String(env.OWNER_USERNAME || "").trim().toLowerCase();
  const password = String(env.OWNER_PASSWORD || "");
  if (!username || !password) return null;

  const salt = randomB64(16);
  const iterations = PBKDF2_ITERATIONS;
  const hash = await hashPassword(password, salt, iterations);
  await env.DB.prepare(
    `INSERT INTO owner (id, username, salt, hash, iterations, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)`
  ).bind(username, salt, hash, iterations, new Date().toISOString()).run();
  return { username, salt, hash, iterations };
}

/* ---------- Session tokens ---------- */
async function issueToken(env, owner) {
  const expiresAt = Date.now() + SESSION_DAYS * 86400000;
  const payload = b64url(JSON.stringify({ u: owner.username, exp: expiresAt }));
  const sig = await sign(sessionKey(env, owner), payload);
  return { token: `${payload}.${sig}`, expiresAt };
}

async function requireOwner(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { error: json({ error: "unauthorized" }, 401) };

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { error: json({ error: "unauthorized" }, 401) };

  let data;
  try { data = JSON.parse(unb64url(payload)); } catch { return { error: json({ error: "unauthorized" }, 401) }; }
  if (!data || typeof data.exp !== "number" || data.exp < Date.now()) {
    return { error: json({ error: "session_expired" }, 401) };
  }

  const owner = await env.DB.prepare("SELECT username, hash FROM owner WHERE id = 1").first();
  if (!owner) return { error: json({ error: "owner_not_configured" }, 503) };

  const expected = await sign(sessionKey(env, owner), payload);
  if (!safeEqual(expected, sig)) return { error: json({ error: "unauthorized" }, 401) };
  return { username: owner.username };
}

function sessionKey(env, owner) {
  return env.SESSION_SECRET || `tastify:${owner.hash}`;
}

/* ---------- Storage ---------- */
const MENU_TABLE = `CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  ord INTEGER NOT NULL,
  cat TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  veg INTEGER NOT NULL DEFAULT 0,
  price INTEGER,
  sizes TEXT,
  prices TEXT,
  note TEXT,
  img TEXT
)`;
const SETTINGS_TABLE = `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;
const OWNER_TABLE = `CREATE TABLE IF NOT EXISTS owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  updated_at TEXT NOT NULL
)`;

let schemaReady = false; // per-isolate cache so we do not re-check on every request

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(MENU_TABLE),
    env.DB.prepare(SETTINGS_TABLE),
    env.DB.prepare(OWNER_TABLE),
  ]);

  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM menu_items").first();
  if (!count || !count.n) {
    const insert = `INSERT OR REPLACE INTO menu_items
      (id, ord, cat, name, veg, price, sizes, prices, note, img)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const statements = MENU_SEED.map((d, i) =>
      env.DB.prepare(insert).bind(
        i + 1,
        d.ord ?? i,
        d.cat,
        d.name,
        d.veg ? 1 : 0,
        d.price ?? null,
        d.sizes ? JSON.stringify(d.sizes) : null,
        d.prices ? JSON.stringify(d.prices) : null,
        d.note ?? null,
        d.img ?? null
      )
    );
    for (let i = 0; i < statements.length; i += 50) {
      await env.DB.batch(statements.slice(i, i + 50));
    }
  }
  schemaReady = true;
}

async function readSettings(env) {
  const row = await env.DB.prepare(
    "SELECT value, updated_at FROM settings WHERE key = 'availability'"
  ).first();
  if (!row) return { items: null, updatedAt: null };
  let items = null;
  try {
    const parsed = parseItems(JSON.parse(row.value));
    items = parsed === undefined ? null : parsed;
  } catch { items = null; }
  return { items, updatedAt: row.updated_at };
}

function rowToItem(row) {
  const item = { cat: row.cat, name: row.name, veg: !!row.veg };
  if (row.price !== null && row.price !== undefined) item.price = row.price;
  if (row.sizes) { try { item.sizes = JSON.parse(row.sizes); } catch {} }
  if (row.prices) { try { item.prices = JSON.parse(row.prices); } catch {} }
  if (row.note) item.note = row.note;
  if (row.img) item.img = row.img;
  return item;
}

/* ---------- Helpers ---------- */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE },
  });
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/* null → "everything available"; array → exactly these dishes.
   undefined → malformed input, caller answers 400. */
function parseItems(raw) {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return undefined;
  const out = [];
  for (const v of raw) {
    if (typeof v !== "string") return undefined;
    const name = v.trim();
    if (!name || name.length > 120) return undefined;
    if (!out.includes(name)) out.push(name);
    if (out.length > 500) return undefined;
  }
  return out;
}

async function hashPassword(password, saltB64, iterations) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iterations || PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function sign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomB64(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf));
}

function b64url(text) {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(text) {
  return atob(text.replace(/-/g, "+").replace(/_/g, "/"));
}

/* Length-independent comparison: no early exit on the first wrong character. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
