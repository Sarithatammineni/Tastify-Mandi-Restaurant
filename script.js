/* ============ Tastify — app logic ============ */
"use strict";

const BASE = "assets/img/dishes/";
const fmt = (n) => "₹" + n.toLocaleString("en-IN");
const WA_PHONE = "919966888060";
const CART_SVG = `<svg class="cart-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;

/* ---------- State ---------- */
let cart = {};            // key -> { name, price, qty }
let activeCat = "All";
let query = "";
let vegOnly = false;
let choosingKey = "";     // combined dish name whose option chooser is open

/* ---------- Elements ---------- */
const $ = (id) => document.getElementById(id);
const menuRoot = $("menuRoot");
const catPills = $("catPills");
const searchInput = $("menuSearch");
const clearBtn = $("clearSearch");
const vegToggle = $("vegOnly");

/* ---------- Persistence ---------- */
function loadCart() {
  try { cart = JSON.parse(localStorage.getItem("tastify-cart") || "{}"); }
  catch { cart = {}; }
}
function saveCart() {
  localStorage.setItem("tastify-cart", JSON.stringify(cart));
}

/* ---------- Menu rendering ---------- */
function matchesFilters(d) {
  if (vegOnly && !d.veg) return false;
  if (activeCat !== "All" && d.cat !== activeCat) return false;
  if (query) {
    const q = query.toLowerCase();
    const hay = (d.name + " " + d.cat).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function dishKey(d, size) {
  return size ? d.name + " · " + size : d.name;
}

/* Dishes whose photo holds two items → concrete options [{name, price}] to pick from.
   - prices map ("Chicken/Mutton Fry", {Chicken:200, Mutton:300}): one option per price,
     name derived by un-joining "Chicken/Mutton" → "Chicken Fry" / "Mutton Fry".
   - "X Fried Rice / Noodles": Noodles inherits X's prefix → "Veg Noodles".
   - "Prawns Fry / Prawns 65": both sides are full names. */
function dishOptions(d) {
  if (d.prices) {
    const keys = Object.keys(d.prices);
    if (keys.length < 2) return null;
    const joined = keys.join("/");
    return keys.map((k) => ({
      name: d.name.includes(joined) ? d.name.replace(joined, k) : `${d.name} · ${k}`,
      price: d.prices[k],
    }));
  }
  if (!d.name.includes(" / ")) return null;
  const [left, right] = d.name.split(" / ").map((s) => s.trim());
  const names = right.split(/\s+/).length > 1
    ? [left, right]                                          // "Prawns Fry / Prawns 65"
    : [left, (left.replace(/( Fried)? Rice$/, "") + " " + right).trim()]; // "Veg Noodles"
  return names.map((n) => ({ name: n, price: d.price }));
}

function renderPills() {
  const cats = ["All", ...CAT_ORDER];
  catPills.innerHTML = "";
  for (const c of cats) {
    const b = document.createElement("button");
    b.className = "pill" + (c === activeCat ? " active" : "");
    b.textContent = c;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", c === activeCat ? "true" : "false");
    b.addEventListener("click", () => {
      activeCat = c;
      renderPills();
      renderMenu();
    });
    catPills.appendChild(b);
  }
}

function priceBlock(d) {
  if (d.sizes) {
    return Object.entries(d.sizes).map(([s, p]) =>
      `<span class="dish-price"><small>${s}</small> ${fmt(p)}</span>`
    ).join("");
  }
  if (d.prices) {
    return Object.entries(d.prices).map(([s, p]) =>
      `<span class="dish-price"><small>${s}</small> ${fmt(p)}</span>`
    ).join("");
  }
  return `<span class="dish-price">${fmt(d.price)}</span>`;
}

function controlsFor(key, price) {
  const inCart = cart[key];
  if (inCart) {
    return `<span class="qty" data-key="${escapeHtml(key)}">
      <button data-act="dec" aria-label="Decrease ${escapeHtml(key)}">−</button>
      <span class="n">${inCart.qty}</span>
      <button data-act="inc" aria-label="Increase ${escapeHtml(key)}">+</button>
    </span>`;
  }
  return `<button class="add-btn" data-key="${escapeHtml(key)}" data-price="${price}"
    data-act="add" aria-label="Add ${escapeHtml(key)} to order">＋ Add</button>`;
}

function addControls(d, size) {
  const key = dishKey(d, size);
  const price = size ? d.sizes[size] : (d.price ?? Object.values(d.prices || {})[0]);
  return controlsFor(key, price);
}

function dishCard(d) {
  const sizes = d.sizes ? Object.keys(d.sizes) : null;
  const opts = dishOptions(d);
  const optsOpen = !!opts && (choosingKey === d.name || opts.some((o) => cart[o.name]));
  const variants = sizes
    ? sizes.map((s) => `
        <div class="dish-row">
          <span class="dish-price"><small>${s}</small> ${fmt(d.sizes[s])}</span>
          ${addControls(d, s)}
        </div>`).join("")
    : optsOpen
      ? opts.map((o) => `
        <div class="dish-row">
          <span class="dish-price"><small>${escapeHtml(o.name)}</small> ${fmt(o.price)}</span>
          ${controlsFor(o.name, o.price)}
        </div>`).join("")
      : `<div class="dish-row">${priceBlock(d)}${opts
          ? `<button class="add-btn" data-act="choose" data-key="${escapeHtml(d.name)}"
              aria-label="Choose which ${escapeHtml(d.name)} to add">＋ Add</button>`
          : addControls(d, null)}</div>`;

  const mark = d.veg
    ? '<span class="veg-mark" title="Veg"></span>'
    : '<span class="nonveg-mark" title="Non-veg"></span>';

  const img = d.img
    ? `<img src="${BASE}${d.img}?v=20261028a" alt="${escapeHtml(d.name)}" loading="lazy"
         onerror="this.remove()">`
    : "";
  return `<article class="dish">
    <div class="dish-img">${img}${mark}</div>
    <div class="dish-body">
      <h4 class="dish-name">${escapeHtml(d.name)}</h4>
      ${d.note ? `<p class="dish-note">${escapeHtml(d.note)}</p>` : ""}
      ${variants}
    </div>
  </article>`;
}

function renderMenu() {
  const filtered = MENU.filter(matchesFilters);
  if (!filtered.length) {
    menuRoot.innerHTML = `<p class="no-results">No dishes match ${escapeHtml(query || "this filter")}. Try clearing the search or veg filter.</p>`;
    return;
  }
  const groups = new Map();
  for (const d of filtered) {
    if (!groups.has(d.cat)) groups.set(d.cat, []);
    groups.get(d.cat).push(d);
  }
  const orderedCats = activeCat === "All"
    ? CAT_ORDER.filter((c) => groups.has(c))
    : [activeCat];

  menuRoot.innerHTML = orderedCats.map((c) => {
    const items = groups.get(c);
    return `<div class="menu-cat" id="cat-${slug(c)}">
      <h3>${escapeHtml(c)} <span class="count">· ${items.length} item${items.length > 1 ? "s" : ""}</span></h3>
      <div class="dish-grid">${items.map(dishCard).join("")}</div>
    </div>`;
  }).join("");
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- Cart ---------- */
function cartCount() {
  return Object.values(cart).reduce((n, it) => n + it.qty, 0);
}
function cartTotal() {
  return Object.values(cart).reduce((n, it) => n + it.qty * it.price, 0);
}

function addToCart(key, price) {
  if (!cart[key]) cart[key] = { name: key, price, qty: 0 };
  cart[key].qty += 1;
  if (cart[key].qty <= 0) delete cart[key];
  syncCart();
}

function syncCart() {
  saveCart();
  const n = cartCount();
  for (const el of [$("cartCount"), $("fabCount")]) {
    el.textContent = n;
    el.hidden = n === 0;
  }
  $("cartTotal").textContent = fmt(cartTotal());
  renderCartItems();
  renderMenu(); // refresh +/qty buttons
  updateWaLink();
}

function renderCartItems() {
  const box = $("cartItems");
  const entries = Object.entries(cart);
  if (!entries.length) {
    box.innerHTML = `<p class="cart-empty"><span class="big">${CART_SVG}</span>Your order is empty.<br>Add some delicious mandi!</p>`;
    return;
  }
  box.innerHTML = entries.map(([key, it]) => `
    <div class="cart-item">
      <span class="ci-name">${escapeHtml(it.name)}<small>${fmt(it.price)} each</small></span>
      <span class="qty" data-key="${escapeHtml(key)}">
        <button data-act="dec" aria-label="Decrease">−</button>
        <span class="n">${it.qty}</span>
        <button data-act="inc" aria-label="Increase">+</button>
      </span>
      <span class="ci-total">${fmt(it.price * it.qty)}</span>
    </div>`).join("");
}

function updateWaLink() {
  const entries = Object.entries(cart);
  const a = $("waOrder");
  if (!entries.length) {
    a.removeAttribute("href");
    a.setAttribute("aria-disabled", "true");
    a.style.opacity = ".6";
    return;
  }
  a.setAttribute("aria-disabled", "false");
  a.style.opacity = "";
  const lines = entries.map(([key, it]) =>
    `• ${it.name} × ${it.qty} = ₹${(it.price * it.qty).toLocaleString("en-IN")}`);
  const msg =
    "Hi Tastify! I'd like to order:\n\n" + lines.join("\n") +
    "\n\nTotal: ₹" + cartTotal().toLocaleString("en-IN") +
    "\n\n(Name: __)\n(Address: __)";
  a.href = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(msg)}`;
}

/* ---------- Drawer ---------- */
function openCart() {
  $("cartDrawer").classList.add("open");
  $("cartDrawer").setAttribute("aria-hidden", "false");
  $("drawerBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeCart() {
  $("cartDrawer").classList.remove("open");
  $("cartDrawer").setAttribute("aria-hidden", "true");
  $("drawerBackdrop").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

/* ---------- Events ---------- */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (btn) {
    e.preventDefault();
    const act = btn.dataset.act;
    if (act === "choose") {
      choosingKey = btn.dataset.key;
      renderMenu();
      return;
    }
    if (act === "add") {
      addToCart(btn.dataset.key, Number(btn.dataset.price));
      choosingKey = "";
      toast("Added to order ✓");
      return;
    }
    const holder = btn.closest(".qty");
    if (holder && holder.dataset.key) {
      const key = holder.dataset.key;
      if (cart[key]) {
        cart[key].qty += act === "inc" ? 1 : -1;
        if (cart[key].qty <= 0) delete cart[key];
        syncCart();
      }
      return;
    }
  }
});

$("cartBtn").addEventListener("click", openCart);
$("cartFab").addEventListener("click", openCart);
$("closeCart").addEventListener("click", closeCart);
$("drawerBackdrop").addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeCart();
  if (choosingKey) { choosingKey = ""; renderMenu(); }
});

$("clearCart").addEventListener("click", () => {
  cart = {};
  syncCart();
  toast("Order cleared");
});

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim();
  clearBtn.hidden = !query;
  renderMenu();
});
clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  query = "";
  clearBtn.hidden = true;
  renderMenu();
  searchInput.focus();
});
vegToggle.addEventListener("change", () => {
  vegOnly = vegToggle.checked;
  renderMenu();
});

/* ---------- Reveal on scroll ---------- */
const revealables = document.querySelectorAll(".special-card, .review-card, .visit-grid, .section-title, .section-sub");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
    }
  }, { threshold: 0.12 });
  revealables.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
}

/* ---------- Init ---------- */
loadCart();
renderPills();
renderMenu();
syncCart();
