// Cart store (localStorage jps_cart_v1). Dispatches window 'jps:cart'.
const KEY = 'jps_cart_v1';
let mem = null;
const subs = new Set();

function load() {
  if (mem) return mem;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    mem = Array.isArray(raw) ? raw.filter(l => l && l.product_id && l.qty > 0) : [];
  } catch { mem = []; }
  return mem;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {}
  const snap = getCart();
  subs.forEach(cb => { try { cb(snap); } catch {} });
  window.dispatchEvent(new CustomEvent('jps:cart', { detail: snap }));
}
// keep tabs in sync
window.addEventListener('storage', e => {
  if (e.key === KEY) { mem = null; const snap = getCart(); subs.forEach(cb => { try { cb(snap); } catch {} }); window.dispatchEvent(new CustomEvent('jps:cart', { detail: snap })); }
});

export function getCart() { return load().map(l => ({ ...l })); }
export function addItem(product, qty = 1) {
  const list = load();
  const id = product.id ?? product.product_id;
  qty = Math.max(1, Math.floor(Number(qty) || 1));
  const max = Number.isFinite(product.stock) && product.stock > 0 ? product.stock : 99;
  const line = list.find(l => l.product_id === id);
  if (line) {
    line.qty = Math.min(line.qty + qty, max);
    line.price = Number(product.price ?? line.price);
  } else {
    list.push({ product_id: id, slug: product.slug || '', name: product.name || '', price: Number(product.price) || 0, image: product.image || null, qty: Math.min(qty, max) });
  }
  save();
}
export function setQty(product_id, qty) {
  qty = Math.floor(Number(qty) || 0);
  if (qty <= 0) return removeItem(product_id);
  const line = load().find(l => l.product_id === product_id);
  if (line) { line.qty = Math.min(qty, 99); save(); }
}
export function removeItem(product_id) {
  mem = load().filter(l => l.product_id !== product_id);
  save();
}
export function clearCart() { mem = []; save(); }
export function cartCount() { return load().reduce((n, l) => n + l.qty, 0); }
export function onCartChange(cb) { subs.add(cb); return () => subs.delete(cb); }
