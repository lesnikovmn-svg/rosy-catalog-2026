import { fetchProductBySlug, submitReviewViaHiddenForm } from "./api.js";
import { addToCart } from "./cart.js";
import { buildTelegramUrl, buildWhatsAppUrl, formatRub, getParam, updateCartBadge } from "./ui.js";

function renderProduct(p, stockById) {
  const qty = Number(stockById[String(p.id)]?.quantity ?? 0);
  const out = qty <= 0;

  document.title = `${p.name} — Каталог роз`;
  const title = document.getElementById("productTitle");
  title.textContent = p.name;

  const img = document.getElementById("productImage");
  img.src = p.image_url || `./images/${encodeURIComponent(p.slug)}-1.jpg`;
  img.alt = p.name;
  img.onerror = () => {
    img.onerror = null;
    img.src = "./images/placeholder.svg";
  };

  const desc = document.getElementById("productDesc");
  desc.textContent = p.description || "";

  const price = document.getElementById("productPrice");
  price.textContent = formatRub(p.price_rub);

  const stock = document.getElementById("productStock");
  stock.textContent = out ? "нет" : `${qty} шт.`;

  const kv = document.getElementById("productKv");
  kv.innerHTML = "";
  const rows = [
    ["Цвет", p.color],
    ["Высота", p.height_cm ? `${p.height_cm} см` : ""],
    ["Тип цветения", p.bloom_type],
  ].filter(([, v]) => Boolean(v));

  if (!rows.length) {
    kv.textContent = "—";
  } else {
    const ul = document.createElement("ul");
    ul.className = "pl-3 mb-0";
    for (const [k, v] of rows) {
      const li = document.createElement("li");
      li.textContent = `${k}: ${v}`;
      ul.appendChild(li);
    }
    kv.appendChild(ul);
  }

  const btn = document.getElementById("addToCartBtn");
  btn.disabled = out;
  btn.textContent = out ? "Нет в наличии" : "В корзину";
  btn.onclick = () => {
    addToCart(p.id, 1);
    updateCartBadge();
    btn.textContent = "Добавлено";
    window.setTimeout(() => (btn.textContent = "В корзину"), 900);
  };

  const productUrl = new URL(`./product.html?slug=${encodeURIComponent(p.slug)}`, window.location.href).toString();
  const orderText = `Хочу заказать ${p.name} (весна 2026)\n${productUrl}`;

  const wa = document.getElementById("orderWhatsApp");
  wa.href = buildWhatsAppUrl({ text: orderText });

  const tg = document.getElementById("orderTelegram");
  tg.href = buildTelegramUrl({ text: orderText, url: productUrl });

  const form = document.getElementById("reviewForm");
  form.dataset.productId = String(p.id);
}

async function init() {
  updateCartBadge();
  const slug = getParam("slug");
  if (!slug) {
    document.getElementById("productTitle").textContent = "Не указан товар";
    return;
  }

  try {
    document.getElementById("productTitle").textContent = "Загрузка…";
    const { product, stockById } = await fetchProductBySlug(slug);
    if (!product) {
      document.getElementById("productTitle").textContent = "Товар не найден.";
      return;
    }
    renderProduct(product, stockById);
  } catch (e) {
    document.getElementById("productTitle").textContent = `Ошибка: ${e.message}`;
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
