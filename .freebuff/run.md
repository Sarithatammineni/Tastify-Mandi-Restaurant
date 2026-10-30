# Tastify — Preview Run Doc

Static site: no build step, no dependencies to install for serving. Plain HTML/CSS/JS served over HTTP.

## Reproduce artifacts

Nothing to generate for serving. (Optional, only when replacing dish photos from new paste files:)

1. Copy the pasted PNG into `assets/img/dishes/<dish-name>-tastify.png`
2. From repo root run `node tools/optimize-images.js` (sharp is installed in `tools/node_modules`) → emits 900px `.webp` (q82) + `.jpg` fallback
3. Delete the PNG originals: `rm -f assets/img/dishes/*-tastify.png`
4. Point the dish's `img:` field in `data.js` at `<dish-name>-tastify.webp`

## Run the server

Python http.server on the project default preview port 8377, detached:

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'python.exe' -ArgumentList '-m','http.server','8377','--bind','127.0.0.1','--directory','C:\Users\tammi\OneDrive\Desktop\Tastify' -RedirectStandardOutput 'C:\Users\tammi\OneDrive\Desktop\Tastify\.freebuff\preview.log' -RedirectStandardError 'C:\Users\tammi\OneDrive\Desktop\Tastify\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

- URL: `http://127.0.0.1:8377/index.html`
- Check: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8377/index.html` → expect `200`
- Logs: `.freebuff/preview.log` (+ `.err`)
- Note: `Start-Process` with redirects can hang the calling shell after the child starts; if the command times out, check `netstat -ano | findstr :8377` — the server is usually already listening. If port 8377 is taken, pick another free port and update the register URL accordingly.
