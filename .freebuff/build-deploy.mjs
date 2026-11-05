// Builds .freebuff/deploy/ — a deploy folder containing ONLY referenced files.
// Scans index.html, styles.css and data.js so CSS-referenced images (e.g. the
// hero background) are included, unlike the previous HTML/JS-only collection.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require(path.join(process.cwd(), "tools", "node_modules", "sharp"));

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".freebuff", "deploy");
const SITE = path.join(OUT, "assets");
const MAX_DISH_WIDTH = 600;
const SHARP_MAX = 0.98 * 1024 * 1024; // ~10MB upload cap, keep headroom

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const refs = new Set();
for (const m of read("styles.css").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) refs.add(m[1]);
for (const m of read("index.html").matchAll(/(?:src|href)="([^"]+)"/g)) {
  const v = m[1];
  if (/^(data:|https?:|mailto:|tel:|#)/.test(v)) continue;
  refs.add(v.split("?")[0]);
}
for (const m of read("data.js").matchAll(/img:\s*["']([^"']+)["']/g)) {
  refs.add(m[1].includes("/") ? m[1] : `assets/img/dishes/${m[1]}`);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SITE, { recursive: true });

// Page shell + code: copy verbatim.
for (const f of ["index.html", "styles.css", "script.js", "data.js"]) {
  fs.copyFileSync(path.join(ROOT, f), path.join(SITE, f));
}

const dishRe = /^assets\/img\/dishes\//;
const missing = [];
const report = [];

for (const rel of refs) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) {
    missing.push(rel);
    continue;
  }
  const dest = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const before = fs.statSync(src).size;
  if (dishRe.test(rel)) {
    const img = sharp(src).resize({ width: MAX_DISH_WIDTH, withoutEnlargement: true });
    if (rel.endsWith(".webp")) await img.webp({ quality: 72 }).toFile(dest);
    else if (/\.jpe?g$/i.test(rel)) await img.jpeg({ quality: 72, mozjpeg: true }).toFile(dest);
    else await img.png({ compressionLevel: 9 }).toFile(dest);
  } else {
    fs.copyFileSync(src, dest);
  }
  report.push([rel, before, fs.statSync(dest).size]);
}

const manifest = {
  entrypoint: "worker.js",
  compatibilityDate: "2026-10-01",
  compatibilityFlags: [],
  modules: [
    { name: "worker.js", type: "esm", path: "worker.js" },
    { name: "menu-seed.js", type: "esm", path: "menu-seed.js" },
  ],
  assetsDirectory: "assets",
  spa: false,
};
// The real worker (site + /api endpoints) and its menu seed ship with the bundle.
fs.copyFileSync(path.join(ROOT, "worker.js"), path.join(OUT, "worker.js"));
fs.copyFileSync(path.join(ROOT, "menu-seed.js"), path.join(OUT, "menu-seed.js"));
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

let total = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else total += fs.statSync(p).size;
  }
};
walk(OUT);

console.log(`referenced files: ${refs.size}`);
console.log(`missing: ${missing.length ? missing.join(", ") : "none"}`);
console.log(`total deploy size: ${(total / 1024 / 1024).toFixed(2)} MB (cap ${(SHARP_MAX / 1024 / 1024).toFixed(2)} MB headroom)`);
const heaviest = report.sort((a, b) => b[2] - a[2]).slice(0, 5);
for (const [rel, before, after] of heaviest) {
  console.log(`  ${rel}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
}
