// Regenerates menu-seed.js from data.js so worker.js can seed the D1 menu table.
// Run after editing data.js:  node .freebuff/gen-menu-seed.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const source = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
const { MENU, CAT_ORDER } = new Function(`${source}\nreturn { MENU, CAT_ORDER };`)();

const rows = MENU.map((d, i) => ({ ...d, ord: i }));
const body = rows.map((d) => "  " + JSON.stringify(d)).join(",\n");

const out = `/* ============ Tastify — generated menu seed ============ */
/* Generated from data.js by .freebuff/gen-menu-seed.mjs — do not edit by hand. */
export const CATEGORIES = ${JSON.stringify(CAT_ORDER)};
export default [
${body},
];
`;

fs.writeFileSync(path.join(ROOT, "menu-seed.js"), out);
console.log(`menu-seed.js written: ${rows.length} items, ${CAT_ORDER.length} categories, ${(out.length / 1024).toFixed(1)} KB`);
