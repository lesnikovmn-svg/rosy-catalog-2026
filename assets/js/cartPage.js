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
    wrap.innerHTML = `<p class="tm-text-gray">Корзина пуста.</p>`;
    return { subtotal: 0, canCheckout: false };
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-responsive";

  const table = document.createElement("table");
  table.className = "table table-striped align-middle";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr>
    <th>Товар</th>
    <th class="text-end">Цена</th>
    <th class="text-center">Кол-во</th>
    <th class="text-end">Сумма</th>
    <th class="text-end">Действия</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

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

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.innerHTML = `<div><a href="./product.html?slug=${encodeURIComponent(p.slug)}">${p.name}</a></div>
      <div class="tm-text-gray small">Наличие: ${out ? "нет" : `${stock} шт.`}${tooMuch ? " · превышение" : ""}</div>`;
    tr.appendChild(tdName);

    const tdPrice = document.createElement("td");
    tdPrice.className = "text-end";
    tdPrice.textContent = formatRub(price);
    tr.appendChild(tdPrice);

    const tdQty = document.createElement("td");
    tdQty.className = "text-center";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = String(qty);
    qtyInput.className = "form-control form-control-sm d-inline-block";
    qtyInput.style.width = "90px";
    qtyInput.addEventListener("change", () => {
      setQty(p.id, qtyInput.value);
      updateCartBadge();
      init();
    });
    tdQty.appendChild(qtyInput);
    tr.appendChild(tdQty);

    const tdTotal = document.createElement("td");
    tdTotal.className = "text-end";
    tdTotal.textContent = formatRub(lineTotal);
    tr.appendChild(tdTotal);

    const tdAct = document.createElement("td");
    tdAct.className = "text-end";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-sm btn-outline-danger";
    del.textContent = "Удалить";
    del.addEventListener("click", () => {
      removeFromCart(p.id);
      updateCartBadge();
      init();
    });
    tdAct.appendChild(del);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  }

  wrap.innerHTML = "";
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);

  const summary = document.createElement("div");
  summary.className = "tm-bg-gray p-4 mt-3";
  summary.innerHTML = `<div class="d-flex justify-content-between align-items-center">
      <div class="tm-text-gray">Итого (без доставки)</div>
      <div class="tm-text-primary h5 mb-0">${formatRub(subtotal)}</div>
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
  document.getElementById("cart").innerHTML = `<p class="tm-text-gray">Ошибка: ${e.message}</p>`;
});
