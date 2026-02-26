import { fetchCatalog, buildOrderPayload, submitOrderViaHiddenForm } from "./api.js";
import { clearCart, readCart, removeFromCart, setQty } from "./cart.js";
import { formatRub, updateCartBadge } from "./ui.js";

function mapById(products) {
  const m = new Map();
  for (const p of products) m.set(String(p.id), p);
  return m;
}

function renderCart({ productsById, stockById }) {
  const wrap = document.getElementById("cart");
  const items = readCart();

  if (!items.length) {
    wrap.innerHTML = `<p class="muted">Корзина пуста.</p>`;
    return { subtotal: 0, canCheckout: false };
  }

  const lines = document.createElement("div");
  lines.className = "table";

  let subtotal = 0;
  let canCheckout = true;

  for (const it of items) {
    const p = productsById.get(String(it.productId));
    if (!p) continue;
    const price = Number(p.price_rub) || 0;
    const qty = Number(it.qty) || 0;
    const stock = Number(stockById[String(p.id)]?.quantity ?? 0);
    const out = stock <= 0;
    const tooMuch = qty > stock && stock > 0;

    if (out || tooMuch) canCheckout = false;

    const lineTotal = price * qty;
    subtotal += lineTotal;

    const row = document.createElement("div");
    row.className = "line";

    const left = document.createElement("div");
    left.innerHTML = `<div><a href="./product.html?slug=${encodeURIComponent(p.slug)}">${p.name}</a></div>
      <div class="muted">${formatRub(price)} · наличие: ${out ? "нет" : `${stock} шт.`}</div>`;

    const qtyInput = document.createElement("input");
    qtyInput.className = "qty";
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = String(qty);
    qtyInput.addEventListener("change", () => {
      setQty(p.id, qtyInput.value);
      updateCartBadge();
      init(); // перерисовать
    });

    const right = document.createElement("div");
    right.style.display = "grid";
    right.style.justifyItems = "end";
    right.style.gap = "6px";

    const total = document.createElement("div");
    total.className = "price";
    total.textContent = formatRub(lineTotal);

    const del = document.createElement("button");
    del.className = "btn btn--ghost";
    del.type = "button";
    del.textContent = "Удалить";
    del.addEventListener("click", () => {
      removeFromCart(p.id);
      updateCartBadge();
      init();
    });

    const warn = document.createElement("div");
    warn.className = "muted";
    warn.style.fontSize = "12px";
    warn.textContent = out ? "Нет в наличии" : tooMuch ? "Количество больше остатка" : "";

    row.appendChild(left);
    row.appendChild(qtyInput);
    right.appendChild(total);
    right.appendChild(del);
    if (warn.textContent) right.appendChild(warn);
    row.appendChild(right);
    lines.appendChild(row);
  }

  wrap.innerHTML = "";
  wrap.appendChild(lines);

  const summary = document.createElement("div");
  summary.className = "panel";
  summary.innerHTML = `<div class="row row--center" style="justify-content:space-between">
    <div class="muted">Итого (без доставки)</div>
    <div class="price">${formatRub(subtotal)}</div>
  </div>`;
  wrap.appendChild(summary);

  return { subtotal, canCheckout };
}

let cached = null;

async function init() {
  updateCartBadge();
  const status = document.getElementById("checkoutStatus");
  status.textContent = "";

  if (!cached) {
    cached = await fetchCatalog();
  }

  const products = Array.isArray(cached.products) ? cached.products.filter((p) => Number(p.is_active) === 1) : [];
  const productsById = mapById(products);
  const stockById = cached.stockById || {};

  const { canCheckout } = renderCart({ productsById, stockById });

  const checkoutForm = document.getElementById("checkoutForm");
  checkoutForm.querySelector('button[type="submit"]').disabled = !canCheckout;
  if (!canCheckout) status.textContent = "Исправьте корзину: нет в наличии или превышение остатка.";

  checkoutForm.onsubmit = (ev) => {
    ev.preventDefault();
    status.textContent = "";

    const items = readCart();
    if (!items.length) {
      status.textContent = "Корзина пуста.";
      return;
    }

    const fd = new FormData(checkoutForm);
    const customer = {
      customer_name: String(fd.get("customer_name") || ""),
      email: String(fd.get("email") || ""),
      phone: String(fd.get("phone") || ""),
      address: String(fd.get("address") || ""),
      comment: String(fd.get("comment") || ""),
    };

    const payload = buildOrderPayload({ customer, items, productsById });
    const postForm = document.getElementById("orderPostForm");
    const frame = document.getElementById("orderFrame");

    try {
      status.textContent = "Отправка заказа…";
      const onLoad = () => {
        frame.removeEventListener("load", onLoad);
        clearCart();
        updateCartBadge();
        status.textContent = "Заказ отправлен. Мы свяжемся с вами для подтверждения.";
        setTimeout(() => init(), 200);
      };
      frame.addEventListener("load", onLoad);
      submitOrderViaHiddenForm(payload, postForm);
    } catch (e) {
      status.textContent = `Ошибка: ${e.message}`;
    }
  };
}

init().catch((e) => {
  document.getElementById("cart").innerHTML = `<p class="muted">Ошибка: ${e.message}</p>`;
});
