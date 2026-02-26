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

    const col = document.createElement("div");
    col.className = "col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12 mb-5";

    const fig = document.createElement("figure");
    fig.className = "effect-ming tm-video-item";

    const img = document.createElement("img");
    img.src = p.image_url || `./images/${encodeURIComponent(p.slug)}-1.jpg`;
    img.alt = p.name;
    img.loading = "lazy";
    img.className = "img-fluid";
    img.onerror = () => {
      img.onerror = null;
      img.src = "./images/placeholder.jpg";
    };
    fig.appendChild(img);

    const cap = document.createElement("figcaption");
    cap.className = "d-flex align-items-center justify-content-center";

    const h2 = document.createElement("h2");
    h2.textContent = p.name;
    cap.appendChild(h2);

    const more = document.createElement("a");
    more.href = `./product.html?slug=${encodeURIComponent(p.slug)}`;
    more.textContent = "Подробнее";
    cap.appendChild(more);

    fig.appendChild(cap);
    col.appendChild(fig);

    const meta = document.createElement("div");
    meta.className = "d-flex justify-content-between tm-text-gray mt-2";

    const left = document.createElement("span");
    left.className = "tm-text-gray-light";
    left.textContent = p.name;
    meta.appendChild(left);

    const right = document.createElement("span");
    right.textContent = formatRub(p.price_rub);
    meta.appendChild(right);

    col.appendChild(meta);

    const tags = [];
    if (p.color) tags.push(String(p.color));
    if (p.height_cm) tags.push(`${p.height_cm} см`);
    if (p.bloom_type) tags.push(String(p.bloom_type));
    if (p.is_new) tags.push("новинка");

    const sub = document.createElement("div");
    sub.className = "tm-text-gray small";
    const stockText = out ? "Нет в наличии" : `В наличии: ${qty} шт.`;
    sub.textContent = tags.length ? `${stockText} · ${tags.join(" · ")}` : stockText;
    col.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "mt-2 d-flex align-items-center";

    const add = document.createElement("button");
    add.className = "btn btn-sm btn-primary";
    add.type = "button";
    add.disabled = out;
    add.textContent = out ? "Нет" : "В корзину";
    add.addEventListener("click", () => {
      addToCart(p.id, 1);
      updateCartBadge();
      add.textContent = "Добавлено";
      window.setTimeout(() => (add.textContent = "В корзину"), 900);
    });
    actions.appendChild(add);

    col.appendChild(actions);
    grid.appendChild(col);
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
