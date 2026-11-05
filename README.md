# Tastify — Arabian Mandi & Restaurant

A complete static website for Tastify, Maisammaguda, Hyderabad — built from the restaurant's own menu cards.

## Open locally
Double-click `index.html`, or serve the folder for the best experience:

```bash
python -m http.server 8377
# then visit http://localhost:8377
```

## What's inside
| File | Purpose |
|---|---|
| `index.html` | Page structure: hero, specials, menu, reviews, visit, cart drawer |
| `styles.css` | Styling — normal system fonts, warm palette, fully responsive |
| `data.js` | All 131 menu items with exact menu-board prices (edit prices here) |
| `script.js` | Menu rendering, search, veg filter, cart + WhatsApp ordering, owner screen, live menu polling |
| `worker.js` | Serves the site and the database API (menu, today's availability, owner login) |
| `menu-seed.js` | Generated from `data.js` — the menu the server seeds into the database |
| `assets/img/favicon.png`, `apple-touch-icon.png` | Tab icon and phone home-screen icon |
| `assets/img/restaurant.png` | Restaurant photo (provided) |
| `assets/img/menu-*.png` | Original menu cards (provided) |
| `assets/img/dishes/` | Free-license dish photos from Wikimedia Commons |
| `tools/fetch-dish-images.js` | Re-runnable script that downloads the dish photos |

## Features
- Every item from the menu cards: Mandi (single/full/family + add-ons & combos), Biryanis, Veg & Non-Veg Starters, Veg & Non-Veg Curries, Flavoured Rice, Fried Rice/Noodles, Breads
- Search, category pills, veg-only filter, veg/non-veg marks
- Cart with quantity controls, saved in the browser (localStorage)
- **Everything lives in the database** — the 131 dishes, today's availability and the owner account are stored in D1 and served by `worker.js`
- **Live menu** — the page re-checks the server every 10 s and whenever the tab regains focus, so an update from the owner reaches open phones without a reload
- **Owner screen for today's menu** — the owner ticks what's available today and customers only see (and can order) those items
- **No customer accounts** — customers browse and order anonymously; only the owner ever signs in
- "Place order on WhatsApp" sends the full order + total to **099668 88060**
- Click-to-call, Google Maps directions, opening hours, rating & reviews

## Owner: today's menu

Not every dish is available every day. The owner controls this from the site itself:

1. Scroll to the footer and tap **Owner login**.
2. Enter the owner **username and password** — this happens once per device: the device keeps a 30-day session token, and reopening the panel goes straight to the item list.
3. Tick the items available today (or **Select all** / **Clear all**) and tap **Save for today**.

Customers then see only the ticked items; anything already sitting in someone's cart is dropped — if the owner hides a dish they can no longer order it. A note above the menu reads *“Today's menu · 68 of 131 items available”*, and open pages refresh themselves within ~10 seconds of a save.

**Customers never sign in.** There is no customer account, no PIN prompt, no login wall — the credentials exist only for the owner's device. Tapping **Sign out** forgets the session on that device.

### What it needs on the server

| Setting | Where | Why |
|---|---|---|
| D1 database bound as **`DB`** | Sites → Storage (or `wrangler d1`) | Holds `menu_items`, `settings` (today's availability) and `owner` (username + password hash). Tables are created and the menu is seeded automatically on the first request |
| Secret **`OWNER_USERNAME`** | Sites → Secrets | The owner's login name (matched case-insensitively) |
| Secret **`OWNER_PASSWORD`** | Sites → Secrets | The owner's password. Stored only as a salted PBKDF2-SHA256 hash; never sent to the browser |
| Secret **`SESSION_SECRET`** (optional) | Sites → Secrets | Signs the session tokens. If unset, a key derived from the stored password hash is used |
| Worker **`worker.js`** + module **`menu-seed.js`** | Deploy root | Serves the site plus the API |

The account row is created on the first successful login attempt from those two secrets; after that the database row is what counts (changing the secrets later does not change an existing account — delete the `owner` row to re-seed it).

Without a database the site still works normally: the menu falls back to the bundled `data.js`, every item is shown, and the owner screen runs in **preview mode** where changes are saved on that device only. `items: null` (the default) means “everything available”, so a fresh deploy never hides the menu.

### API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/menu` | public | Menu + availability + `updatedAt` (falls back to the bundled menu if the DB errors) |
| `GET /api/availability` | public | Small payload the page polls for live updates |
| `POST /api/login` | public | `{ username, password }` → `{ token, expiresAt }` |
| `GET /api/session` | Bearer token | Validates a stored token |
| `POST /api/availability` | Bearer token | `{ items: ["Dish name", …] | null }` — saves today's menu |
| `GET /api/health` | public | `{ ok, db }` |

### Run it locally with a real database

```bash
node .freebuff/dev-server.mjs 8377
```

Runs the real `worker.js` against a local SQLite file (`.freebuff/dev.db`, same SQL dialect as D1) and serves the static files. Local login: `owner` / `tastify123` — development only; production uses the secrets above.

## Notes
- A few hard-to-read names on the photographed menu were best-effort transcriptions. Verify against the physical card and correct in `data.js` if needed. ("Veg Kodo" → "Veg Kadai", "Veg Koptha Curry" → "Veg Kofta Curry", "Chel Paneer" → "Chaat Paneer" were fixed; "Peshawari" was confirmed as a real dish.)
- Most dishes now use the restaurant's own photos (`*-tastify.webp`, optimized to ≲220 KB). To deploy: upload the whole folder to any static host (Netlify, Vercel, GitHub Pages).
