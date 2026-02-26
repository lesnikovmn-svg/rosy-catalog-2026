import { APPS_SCRIPT_URL, USE_LOCAL_SAMPLE_DATA_WHEN_NO_API } from "./config.js";
import { jsonp } from "./jsonp.js";

async function loadLocalSample() {
  const res = await fetch("./data/products.sample.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить sample данные");
  const products = await res.json();
  return { products, stockById: {} };
}

export async function fetchCatalog() {
  if (!APPS_SCRIPT_URL) {
    if (USE_LOCAL_SAMPLE_DATA_WHEN_NO_API) return loadLocalSample();
    throw new Error("Не настроен APPS_SCRIPT_URL");
  }

  const url = `${APPS_SCRIPT_URL}?action=catalog&_ts=${Date.now()}`;
  try {
    return await jsonp(url, { timeoutMs: 20000 });
  } catch (e) {
    if (USE_LOCAL_SAMPLE_DATA_WHEN_NO_API) return loadLocalSample();
    throw e;
  }
}

export async function fetchProductBySlug(slug) {
  const { products, stockById } = await fetchCatalog();
  const product = products.find((p) => String(p.slug) === String(slug));
  return { product, stockById };
}

export function buildOrderPayload({ customer, items, productsById }) {
  const orderItems = items.map((it) => {
    const p = productsById.get(String(it.productId));
    const price = Number(p?.price_rub ?? 0);
    const qty = Number(it.qty) || 0;
    return {
      product_id: String(it.productId),
      product_name: String(p?.name ?? ""),
      price_rub: price,
      qty,
      line_total_rub: price * qty,
    };
  });

  const subtotal = orderItems.reduce((s, x) => s + (Number(x.line_total_rub) || 0), 0);
  const discount = 0;
  const total = subtotal - discount;

  return {
    customer_name: customer.customer_name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    comment: customer.comment || "",
    currency: "RUB",
    subtotal_rub: subtotal,
    discount_rub: discount,
    total_rub: total,
    items: orderItems,
  };
}

export function submitOrderViaHiddenForm(payload, formEl) {
  if (!APPS_SCRIPT_URL) throw new Error("Не настроен APPS_SCRIPT_URL");
  formEl.action = APPS_SCRIPT_URL;
  const payloadField = formEl.querySelector('input[name="payload"]');
  payloadField.value = JSON.stringify(payload);
  formEl.submit();
}

function ensureHiddenFrame_(name) {
  let frame = document.querySelector(`iframe[name="${String(name)}"]`);
  if (frame) return frame;
  frame = document.createElement("iframe");
  frame.name = name;
  frame.title = name;
  frame.className = "hidden";
  document.body.appendChild(frame);
  return frame;
}

export function submitReviewViaHiddenForm(payload) {
  if (!APPS_SCRIPT_URL) throw new Error("Не настроен APPS_SCRIPT_URL");
  ensureHiddenFrame_("orderFrame");
  const form = document.createElement("form");
  form.method = "POST";
  form.action = APPS_SCRIPT_URL;
  form.target = "orderFrame";
  form.className = "hidden";

  const action = document.createElement("input");
  action.type = "hidden";
  action.name = "action";
  action.value = "review";
  form.appendChild(action);

  const data = document.createElement("input");
  data.type = "hidden";
  data.name = "payload";
  data.value = JSON.stringify(payload);
  form.appendChild(data);

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
