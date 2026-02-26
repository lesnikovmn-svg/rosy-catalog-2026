import { cartCount } from "./cart.js";

export function formatRub(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

export function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = cartCount();
  if (count > 0) {
    el.hidden = false;
    el.textContent = String(count);
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

export function getParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

