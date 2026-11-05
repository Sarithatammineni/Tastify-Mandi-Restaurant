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
| `script.js` | Menu rendering, search, veg filter, cart + WhatsApp ordering, owner screen |
| `worker.js` | Serves the site and the two `/api/availability` endpoints (owner's daily menu) |
| `assets/img/restaurant.png` | Restaurant photo (provided) |
| `assets/img/menu-*.png` | Original menu cards (provided) |
| `assets/img/dishes/` | Free-license dish photos from Wikimedia Commons |
| `tools/fetch-dish-images.js` | Re-runnable script that downloads the dish photos |

## Features
- Every item from the menu cards: Mandi (single/full/family + add-ons & combos), Biryanis, Veg & Non-Veg Starters, Veg & Non-Veg Curries, Flavoured Rice, Fried Rice/Noodles, Breads
- Search, category pills, veg-only filter, veg/non-veg marks
- Cart with quantity controls, saved in the browser (localStorage)
- **Owner screen for today's menu** — the owner ticks what's available today and customers only see (and can order) those items
- "Place order on WhatsApp" sends the full order + total to **099668 88060**
- Click-to-call, Google Maps directions, opening hours, rating & reviews

## Owner: today's menu

Not every dish is available every day. The owner controls this from the site itself:

1. Scroll to the footer and tap **Owner login**.
2. Enter the owner PIN once — that device remembers it.
3. Tick the items available today (or **Select all** / **Clear all**) and tap **Save for today**.

Customers then see only the ticked items; anything already sitting in someone's cart is dropped — if the owner hides a dish they can no longer order it. A note above the menu reads *“Today's menu · 68 of 131 items available”*.

### What it needs on the server

| Setting | Where | Why |
|---|---|---|
| D1 database bound as **`DB`** | Sites → Storage (or `wrangler d1`) | Holds the one-row `availability` table; created automatically on first save |
| Secret **`OWNER_PIN`** | Sites → Secrets (or `wrangler secret put OWNER_PIN`) | The owner PIN. It is checked server-side in `worker.js`, so it never ships to the browser |
| Worker **`worker.js`** | Deploy root | Serves the site plus `/api/availability` and `/api/owner-check` |

Without them the site still works normally: every item is shown, and the owner screen runs in **preview mode** where changes are saved on that device only. `items: null` (the default) means “everything available”, so a fresh deploy never hides the menu.

## Notes
- A few hard-to-read names on the photographed menu were best-effort transcriptions. Verify against the physical card and correct in `data.js` if needed. ("Veg Kodo" → "Veg Kadai", "Veg Koptha Curry" → "Veg Kofta Curry", "Chel Paneer" → "Chaat Paneer" were fixed; "Peshawari" was confirmed as a real dish.)
- Most dishes now use the restaurant's own photos (`*-tastify.webp`, optimized to ≲220 KB). To deploy: upload the whole folder to any static host (Netlify, Vercel, GitHub Pages).
