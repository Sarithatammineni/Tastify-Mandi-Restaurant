// Checks worker.js against a stubbed D1 database.
// worker.js imports ./menu-seed.js; the seed is inlined here so the module can be
// loaded through a data: URL (this project has no package.json, so .js is CJS).
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const seedSource = fs.readFileSync(new URL("menu-seed.js", root), "utf8");
const { MENU_SEED, CATEGORIES } = new Function(
  seedSource
    .replace("export const CATEGORIES =", "const CATEGORIES =")
    .replace("export default [", "const MENU_SEED = [") +
    "\nreturn { MENU_SEED, CATEGORIES };"
)();

let workerSource = fs.readFileSync(new URL("worker.js", root), "utf8");
workerSource = workerSource.replace(
  /^import .*menu-seed\.js.*$/m,
  `const MENU_SEED = ${JSON.stringify(MENU_SEED)};\nconst CATEGORIES = ${JSON.stringify(CATEGORIES)};`
);
const worker = (await import(
  "data:text/javascript;base64," + Buffer.from(workerSource).toString("base64")
)).default;

/* ---------- Stub D1 ---------- */
function makeDB() {
  const menu = [];
  const settings = new Map();
  let owner = null;

  const stmt = (sql, args = []) => ({
    sql,
    args,
    bind(...a) { return stmt(sql, a); },
    async first() {
      if (/SELECT COUNT\(\*\) AS n FROM menu_items/.test(sql)) return { n: menu.length };
      if (/FROM settings WHERE key = 'availability'/.test(sql)) {
        const row = settings.get("availability");
        return row ? { value: row.value, updated_at: row.updated_at } : null;
      }
      if (/SELECT username, salt, hash, iterations FROM owner/.test(sql)) return owner;
      if (/SELECT username, hash FROM owner/.test(sql)) {
        return owner && { username: owner.username, hash: owner.hash };
      }
      return null;
    },
    async all() {
      if (/FROM menu_items ORDER BY ord/.test(sql)) {
        return { results: [...menu].sort((a, b) => a.ord - b.ord) };
      }
      return { results: [] };
    },
    async run() {
      if (/INSERT OR REPLACE INTO menu_items/.test(sql)) {
        const [id, ord, cat, name, veg, price, sizes, prices, note, img] = args;
        menu.push({ id, ord, cat, name, veg, price, sizes, prices, note, img });
      } else if (/INSERT INTO settings/.test(sql)) {
        settings.set("availability", { value: args[0], updated_at: args[1] });
      } else if (/INSERT INTO owner/.test(sql)) {
        const [username, salt, hash, iterations, updated_at] = args;
        owner = { username, salt, hash, iterations, updated_at };
      }
      return { success: true };
    },
  });

  return {
    prepare: (sql) => stmt(sql),
    async batch(list) {
      const out = [];
      for (const s of list) out.push(await s.run());
      return out;
    },
  };
}

const ASSETS = { async fetch() { return new Response("asset-ok", { status: 200 }); } };
const call = (env, path, init) =>
  worker.fetch(new Request("https://tastify.test" + path, init), env);
const auth = (token) => ({ authorization: "Bearer " + token });

let fails = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else { fails++; console.log(`  FAIL ${name} ${extra}`); }
};

console.log("no database");
{
  const menu = await (await call({ ASSETS }, "/api/menu")).json();
  check("menu falls back to bundled seed", menu.source === "bundled" && menu.items.length === 131, menu.source);
  check("availability null without db", menu.availability === null);

  const login = await call({ ASSETS }, "/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "a", password: "b" }),
  });
  check("login → 503 without db", login.status === 503);
}

const env = { ASSETS, DB: makeDB(), OWNER_USERNAME: "Owner", OWNER_PASSWORD: "s3cret-pass" };

console.log("menu seeding");
{
  const menu = await (await call(env, "/api/menu")).json();
  check("source db", menu.source === "db", menu.source);
  check("131 items seeded", menu.items.length === 131, String(menu.items.length));
  check(
    "sizes survive the round-trip",
    JSON.stringify(menu.items[0].sizes) === '{"Single":229,"Full":379,"Family":549}',
    JSON.stringify(menu.items[0])
  );
  check("veg flag is boolean", menu.items[1].veg === true);
  check("no availability yet", menu.availability === null);
}

console.log("owner login");
let token = "";
{
  const bad = await call(env, "/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "owner", password: "nope" }),
  });
  check("wrong password → 401", bad.status === 401);

  const ok = await call(env, "/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "Owner", password: "s3cret-pass" }),
  });
  const body = await ok.json();
  token = body.token;
  check("login → 200 + token", ok.status === 200 && typeof token === "string" && token.includes("."));
  check("username normalised", body.username === "owner");

  const session = await call(env, "/api/session", { headers: auth(token) });
  check("session valid", session.status === 200);

  const tampered = await call(env, "/api/session", {
    headers: auth(token.slice(0, -2) + "ff"),
  });
  check("tampered token → 401", tampered.status === 401);

  const anon = await call(env, "/api/session");
  check("no token → 401", anon.status === 401);
}

console.log("saving today's menu");
{
  const anon = await call(env, "/api/availability", {
    method: "POST",
    body: JSON.stringify({ items: ["Chicken Mandi"] }),
  });
  check("save without token → 401", anon.status === 401);

  const save = await call(env, "/api/availability", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ items: ["Chicken Mandi", "Paneer Mandi", "Chicken Mandi"] }),
  });
  const saved = await save.json();
  check("saves and de-duplicates", save.status === 200 && saved.items.length === 2, JSON.stringify(saved));

  const live = await (await call(env, "/api/availability")).json();
  check(
    "polling endpoint returns the list",
    JSON.stringify(live.items) === '["Chicken Mandi","Paneer Mandi"]',
    JSON.stringify(live)
  );
  check("updatedAt is set", typeof live.updatedAt === "string" && live.updatedAt.length > 10);

  const menu = await (await call(env, "/api/menu")).json();
  check("menu carries availability", Array.isArray(menu.availability) && menu.availability.length === 2);

  const all = await call(env, "/api/availability", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ items: null }),
  });
  check("null = everything available", all.status === 200);
  const after = await (await call(env, "/api/availability")).json();
  check("GET returns null again", after.items === null);
  check("updatedAt moves", after.updatedAt !== live.updatedAt);
}

console.log("validation");
{
  const badItems = await call(env, "/api/availability", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ items: "Chicken Mandi" }),
  });
  check("non-array items → 400", badItems.status === 400);

  const missing = await call(env, "/api/login", { method: "POST", body: JSON.stringify({}) });
  check("missing credentials → 400", missing.status === 400);
}

console.log("owner account bootstrap");
{
  const fresh = { ASSETS, DB: makeDB(), OWNER_USERNAME: "boss", OWNER_PASSWORD: "another-pass" };
  const login = await call(fresh, "/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "boss", password: "another-pass" }),
  });
  check("creates owner on first login", login.status === 200, String(login.status));

  const noEnv = { ASSETS, DB: makeDB() };
  const blocked = await call(noEnv, "/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "boss", password: "another-pass" }),
  });
  check("no owner + no secrets → 503", blocked.status === 503, String(blocked.status));
}

console.log("static passthrough");
{
  const res = await call(env, "/index.html");
  check("non-API path hits ASSETS", res.status === 200);
  const missing = await call(env, "/api/nope");
  check("unknown API path → 404", missing.status === 404);
}

console.log(fails ? `\n${fails} FAILED` : "\nall worker checks passed");
process.exit(fails ? 1 : 0);
