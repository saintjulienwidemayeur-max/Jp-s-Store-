// Storefront data helpers on top of api.js. Uses the category/paging API (listCategories({featured}), getCategory,
// listProductsPaged) when present and degrades to listProducts so the pages never depend on a single build of api.js.
import * as api from './api.js';

export const FANZONE = 'fan-zone';

export async function getCategories({ featured } = {}) {
  let list = await api.listCategories(featured ? { featured: true } : {});
  list = (list || []).filter((c) => c.is_active !== false);
  if (featured) list = list.filter((c) => c.is_featured !== false);
  return list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export async function getCategoryBySlug(slug) {
  if (!slug) return null;
  let c = null;
  if (typeof api.getCategory === 'function') c = await api.getCategory(slug);
  else c = ((await api.listCategories({})) || []).find((x) => x.slug === slug) || null;
  return c && c.is_active !== false ? c : null;
}

// Tree helpers: roots + children by parent_id (missing parent_id means root).
export function buildTree(cats) {
  const byId = new Map(cats.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const n of byId.values()) {
    const parent = n.parent_id && byId.get(n.parent_id);
    (parent ? parent.children : roots).push(n);
  }
  return roots;
}
export function scopeSlugs(cats, slug) {
  if (!slug) return [];
  const me = cats.find((c) => c.slug === slug);
  if (!me) return [slug];
  const out = [slug];
  const walk = (id) => cats.filter((c) => c.parent_id === id).forEach((c) => { out.push(c.slug); walk(c.id); });
  walk(me.id);
  return out;
}

export async function listPaged(o = {}) {
  if (typeof api.listProductsPaged === 'function') return api.listProductsPaged(o);
  const { categories, q, sort = 'popular', minPrice, maxPrice, inStock, featured, page = 1, pageSize = 12 } = o;
  let list = await api.listProducts({ q: q || undefined, sort });
  if (categories && categories.length) list = list.filter((p) => categories.includes(p.category_slug));
  if (featured) list = list.filter((p) => p.is_featured);
  if (Number.isFinite(minPrice)) list = list.filter((p) => p.price >= minPrice);
  if (Number.isFinite(maxPrice)) list = list.filter((p) => p.price <= maxPrice);
  if (inStock) list = list.filter((p) => p.stock === undefined || p.stock > 0);
  const total = list.length;
  const start = (Math.max(1, page) - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), total, page: Math.max(1, page), pageSize };
}

export async function listFeatured(limit = 8) {
  let items = [];
  try { items = (await listPaged({ featured: true, page: 1, pageSize: limit, sort: 'popular' })).items || []; } catch { items = []; }
  if (!items.length) items = await api.listProducts({ sort: 'popular', limit });
  return items.slice(0, limit);
}
export async function listNewest(limit = 4) {
  return (await listPaged({ sort: 'new', page: 1, pageSize: limit })).items || [];
}
