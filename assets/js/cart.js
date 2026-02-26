const CART_KEY = "rosy_cart_v1";

export function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function cartCount() {
  return readCart().reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
}

export function addToCart(productId, qty = 1) {
  const items = readCart();
  const existing = items.find((x) => String(x.productId) === String(productId));
  if (existing) existing.qty = (Number(existing.qty) || 0) + (Number(qty) || 0);
  else items.push({ productId: String(productId), qty: Number(qty) || 1 });
  writeCart(items);
}

export function setQty(productId, qty) {
  const items = readCart();
  const q = Math.max(0, Number(qty) || 0);
  const next = items
    .map((x) => (String(x.productId) === String(productId) ? { ...x, qty: q } : x))
    .filter((x) => (Number(x.qty) || 0) > 0);
  writeCart(next);
}

export function removeFromCart(productId) {
  const items = readCart().filter((x) => String(x.productId) !== String(productId));
  writeCart(items);
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
}

