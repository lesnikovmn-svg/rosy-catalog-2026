import { cartCount } from "./cart.js";
import { TELEGRAM_USERNAME, WHATSAPP_PHONE } from "./config.js";

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

export function buildWhatsAppUrl({ text, phone = WHATSAPP_PHONE } = {}) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(text || ""))}`;
}

export function buildTelegramUrl({ text, url, username = TELEGRAM_USERNAME } = {}) {
  if (username) {
    // Share link works without bot/permissions and supports prefilled text.
    return `https://t.me/share/url?url=${encodeURIComponent(String(url || ""))}&text=${encodeURIComponent(String(text || ""))}`;
  }
  return "";
}
