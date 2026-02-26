import { fetchProductBySlug, submitReviewViaHiddenForm } from "./api.js";
import { addToCart } from "./cart.js";
import { formatRub, getParam, updateCartBadge } from "./ui.js";

function renderProduct(p, stockById) {
  const wrap = document.getElementById("product");
  const qty = Number(stockById[String(p.id)]?.quantity ?? 0);
  const out = qty <= 0;

  document.title = `${p.name} — Каталог роз`;
  document.getElementById("crumb").textContent = p.name;

  wrap.innerHTML = "";

  const img = document.createElement("img");
  img.className = "product__img";
  img.alt = p.name;
  img.src = p.image_url || "";

  const box = document.createElement("div");
  box.className = "product__box";

  const h = document.createElement("h1");
  h.textContent = p.name;
  box.appendChild(h);

  const desc = document.createElement("p");
  desc.className = "muted";
  desc.textContent = p.description || "";
  box.appendChild(desc);

  const price = document.createElement("div");
  price.className = "price";
  price.textContent = formatRub(p.price_rub);
  box.appendChild(price);

  const kv = document.createElement("div");
  kv.className = "kv";
  const rows = [
    ["Цвет", p.color],
    ["Высота", p.height_cm ? `${p.height_cm} см` : ""],
    ["Тип цветения", p.bloom_type],
    ["Наличие", out ? "нет" : `${qty} шт.`],
  ];
  for (const [k, v] of rows) {
    const a = document.createElement("span");
    a.textContent = k;
    const b = document.createElement("div");
    b.textContent = v || "—";
    kv.appendChild(a);
    kv.appendChild(b);
  }
  box.appendChild(kv);

  const row = document.createElement("div");
  row.className = "row row--center";
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = out ? "Нет в наличии" : "Добавить в корзину";
  btn.disabled = out;
  btn.addEventListener("click", () => {
    addToCart(p.id, 1);
    updateCartBadge();
    btn.textContent = "Добавлено";
    window.setTimeout(() => (btn.textContent = "Добавить в корзину"), 900);
  });
  row.appendChild(btn);
  box.appendChild(row);

  wrap.appendChild(img);
  wrap.appendChild(box);

  const form = document.getElementById("reviewForm");
  form.dataset.productId = String(p.id);
}

async function init() {
  updateCartBadge();
  const slug = getParam("slug");
  const wrap = document.getElementById("product");
  if (!slug) {
    wrap.textContent = "Не указан товар (slug).";
    return;
  }

  try {
    wrap.textContent = "Загрузка…";
    const { product, stockById } = await fetchProductBySlug(slug);
    if (!product) {
      wrap.textContent = "Товар не найден.";
      return;
    }
    renderProduct(product, stockById);
  } catch (e) {
    wrap.textContent = `Ошибка: ${e.message}`;
  }

  const form = document.getElementById("reviewForm");
  const status = document.getElementById("reviewStatus");

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    status.textContent = "";

    const fd = new FormData(form);
    const payload = {
      product_id: form.dataset.productId,
      author_name: String(fd.get("author_name") || ""),
      author_email: String(fd.get("author_email") || ""),
      rating: Number(fd.get("rating") || 5),
      text: String(fd.get("text") || ""),
    };

    try {
      submitReviewViaHiddenForm(payload);
      form.reset();
      status.textContent = "Отзыв отправлен на модерацию.";
    } catch (e) {
      status.textContent = `Ошибка: ${e.message}`;
    }
  });
}

init();

