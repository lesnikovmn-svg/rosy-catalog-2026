import { fetchCatalog } from "./api.js";
import { addToCart } from "./cart.js";
import { formatRub, updateCartBadge } from "./ui.js";

const state = {
  products: [],
  stockById: {},
};

function normalizeText(v) {
  return String(v || "").toLowerCase().trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ru"));
}

function applyFilters() {
  const q = normalizeText(document.getElementById("q").value);
  const color = document.getElementById("color").value;
  const bloomType = document.getElementById("bloomType").value;
  const hMin = Number(document.getElementById("hMin").value || "");
  const hMax = Number(document.getElementById("hMax").value || "");

  return state.products.filter((p) => {
    if (Number(p.is_active) !== 1) return false;
    if (q) {
      const hay = normalizeText(`${p.name} ${p.slug} ${p.description}`);
      if (!hay.includes(q)) return false;
    }
    if (color && String(p.color || "") !== String(color)) return false;
    if (bloomType && String(p.bloom_type || "") !== String(bloomType)) return false;
    const h = Number(p.height_cm) || 0;
    if (!Number.isNaN(hMin) && hMin > 0 && h < hMin) return false;
    if (!Number.isNaN(hMax) && hMax > 0 && h > hMax) return false;
    return true;
  });
}

function applySort(products) {
  const v = document.getElementById("sort").value;
  const copy = [...products];
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), "ru");

  switch (v) {
    case "price_asc":
      copy.sort((a, b) => (Number(a.price_rub) || 0) - (Number(b.price_rub) || 0));
      break;
    case "price_desc":
      copy.sort((a, b) => (Number(b.price_rub) || 0) - (Number(a.price_rub) || 0));
      break;
    case "new_desc":
      copy.sort((a, b) => (Number(b.is_new) || 0) - (Number(a.is_new) || 0) || byName(a, b));
      break;
    case "name_asc":
      copy.sort(byName);
      break;
    case "popularity_desc":
    default:
      copy.sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0) || byName(a, b));
      break;
  }
  return copy;
}

function render(products) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  for (const p of products) {
    const qty = Number(state.stockById[String(p.id)]?.quantity ?? 0);
    const out = qty <= 0;

    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "card__img";
    img.alt = p.name;
    img.loading = "lazy";
    img.src = p.image_url || "";
    card.appendChild(img);

    const body = document.createElement("div");
    body.className = "card__body";

    const a = document.createElement("a");
    a.href = `./product.html?slug=${encodeURIComponent(p.slug)}`;
    a.className = "card__title";
    a.textContent = p.name;
    body.appendChild(a);

    const pills = document.createElement("div");
    pills.className = "pillrow";
    for (const t of [p.color, p.height_cm ? `${p.height_cm} см` : "", p.bloom_type, p.is_new ? "новинка" : ""]) {
      if (!t) continue;
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = String(t);
      pills.appendChild(span);
    }
    body.appendChild(pills);

    const row = document.createElement("div");
    row.className = "row row--center";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formatRub(p.price_rub);
    row.appendChild(price);

    const btn = document.createElement("button");
    btn.className = "btn btn--ghost";
    btn.textContent = out ? "Нет в наличии" : "В корзину";
    btn.disabled = out;
    btn.addEventListener("click", () => {
      addToCart(p.id, 1);
      updateCartBadge();
      btn.textContent = "Добавлено";
      window.setTimeout(() => (btn.textContent = "В корзину"), 900);
    });
    row.appendChild(btn);

    body.appendChild(row);
    card.appendChild(body);
    grid.appendChild(card);
  }

  const status = document.getElementById("status");
  status.textContent = products.length ? `Найдено: ${products.length}` : "Ничего не найдено";
}

function onChange() {
  const filtered = applyFilters();
  const sorted = applySort(filtered);
  render(sorted);
}

async function init() {
  updateCartBadge();
  const status = document.getElementById("status");

  try {
    status.textContent = "Загрузка каталога…";
    const data = await fetchCatalog();
    state.products = Array.isArray(data.products) ? data.products : [];
    state.stockById = data.stockById || {};

    const colors = uniq(state.products.map((p) => p.color));
    const bloomTypes = uniq(state.products.map((p) => p.bloom_type));

    const colorSel = document.getElementById("color");
    for (const c of colors) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      colorSel.appendChild(opt);
    }

    const bloomSel = document.getElementById("bloomType");
    for (const b of bloomTypes) {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      bloomSel.appendChild(opt);
    }

    for (const id of ["q", "color", "hMin", "hMax", "bloomType", "sort"]) {
      document.getElementById(id).addEventListener("input", onChange);
      document.getElementById(id).addEventListener("change", onChange);
    }

    onChange();
  } catch (e) {
    status.textContent = `Ошибка: ${e.message}`;
  }
}

init();

