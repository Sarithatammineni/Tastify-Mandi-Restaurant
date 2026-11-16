# Tastify — Preview Run Doc

Static site: no build step, no dependencies to install for serving. Plain HTML/CSS/JS served over HTTP.

## Reproduce artifacts

Nothing to generate for serving. (Optional, only when replacing dish photos from new paste files:)

1. Copy the pasted PNG into `assets/img/dishes/<dish-name>-tastify.png`
2. From repo root run `node tools/optimize-images.js` (sharp is installed in `tools/node_modules`) → emits 900px `.webp` (q82) + `.jpg` fallback
3. Delete the PNG originals: `rm -f assets/img/dishes/*-tastify.png`
4. Point the dish's `img:` field in `data.js` at `<dish-name>-tastify.webp`

## Check the API

```bash
node .freebuff/worker-test.mjs
```

Runs `worker.js` against a stubbed D1 database: menu seeding, owner login (wrong password, normalisation, tampered/absent tokens), save + read-back through the polling endpoint, `null` = all available, input validation, asset passthrough. Expect `all worker checks passed`.

## Regenerate the menu seed

`worker.js` seeds the database from `menu-seed.js`, which is generated from `data.js`. After editing `data.js`:

```bash
node .freebuff/gen-menu-seed.mjs
```

## Build the deploy folder

A deploy may only ship files that are actually referenced, and the reference scan **must include `styles.css`** — the hero background (`assets/img/restaurant.png`) is referenced only from CSS. Earlier builds scanned `index.html` + `data.js` only, which silently dropped the hero photo on the live site (big empty grey block at the top).

```bash
node .freebuff/build-deploy.mjs
```

- Emits `.freebuff/deploy/` (`manifest.json`, `worker.js`, `menu-seed.js`, `assets/` with page files + every referenced image)
- The manifest lists both modules — `worker.js` imports `menu-seed.js`, so both must ship
- Dish photos are downscaled to 600px wide and re-encoded for the upload (~10 MB cap)
- Prints total size; expect ~6.7 MB and `missing: none`

## Run the server

**Use the dev server for preview** — it runs the real `worker.js` against a local SQLite database (Node 24's built-in `node:sqlite`, same dialect as D1), so the menu, owner login and live updates all work locally:

```bash
node .freebuff/dev-server.mjs 8377
```

- URL: `http://127.0.0.1:8377/index.html`
- Local login: `owner` / `tastify123` (development only)
- Database: `.freebuff/dev.db` (git-ignored). Delete it to start from a fresh, fully-seeded database
- Check: `curl -s http://127.0.0.1:8377/api/health` → `{"ok":true,"db":true,…}`

A plain static server also still works for the markup/CSS, but the owner panel is then in preview mode (no login, changes stay on that device). Python http.server on port 8377, detached:

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'python.exe' -ArgumentList '-m','http.server','8377','--bind','127.0.0.1','--directory','C:\Users\tammi\OneDrive\Desktop\Tastify' -RedirectStandardOutput 'C:\Users\tammi\OneDrive\Desktop\Tastify\.freebuff\preview.log' -RedirectStandardError 'C:\Users\tammi\OneDrive\Desktop\Tastify\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

- URL: `http://127.0.0.1:8377/index.html`
- Check: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8377/index.html` → expect `200`
- Logs: `.freebuff/preview.log` (+ `.err`)
- Note: `Start-Process` with redirects can hang the calling shell after the child starts; if the command times out, check `netstat -ano | findstr :8377` — the server is usually already listening. If port 8377 is taken, pick another free port and update the register URL accordingly.
