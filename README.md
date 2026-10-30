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
| `script.js` | Menu rendering, search, veg filter, cart + WhatsApp ordering |
| `assets/img/restaurant.png` | Restaurant photo (provided) |
| `assets/img/menu-*.png` | Original menu cards (provided) |
| `assets/img/dishes/` | Free-license dish photos from Wikimedia Commons |
| `tools/fetch-dish-images.js` | Re-runnable script that downloads the dish photos |

## Features
- Every item from the menu cards: Mandi (single/full/family + add-ons & combos), Biryanis, Veg & Non-Veg Starters, Veg & Non-Veg Curries, Flavoured Rice, Fried Rice/Noodles, Breads
- Search, category pills, veg-only filter, veg/non-veg marks
- Cart with quantity controls, saved in the browser (localStorage)
- "Place order on WhatsApp" sends the full order + total to **099668 88060**
- Click-to-call, Google Maps directions, opening hours, rating & reviews

## Notes
- A few hard-to-read names on the photographed menu were best-effort transcriptions. Verify against the physical card and correct in `data.js` if needed. ("Veg Kodo" → "Veg Kadai", "Veg Koptha Curry" → "Veg Kofta Curry", "Chel Paneer" → "Chaat Paneer" were fixed; "Peshawari" was confirmed as a real dish.)
- Most dishes now use the restaurant's own photos (`*-tastify.webp`, optimized to ≲220 KB). To deploy: upload the whole folder to any static host (Netlify, Vercel, GitHub Pages).
