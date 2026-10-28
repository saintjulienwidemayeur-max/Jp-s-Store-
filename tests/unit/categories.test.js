import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../../js/api.js';

const rejects = (p, code) => assert.rejects(p, (e) => e.code === code);
const asAdmin = () => api.signIn({ email: 'admin@jpslogistics.me', password: 'admin123' });
const slugs = (l) => l.map((x) => x.slug);

beforeEach(async () => { api._resetLocalForTests(); await api.signOut(); });

test('local seed: Fan Zone real, six clearly-sample categories', async () => {
  const cats = await api.listCategories();
  assert.equal(cats[0].slug, 'fan-zone');
  assert.equal(cats.length, 7);
  assert.deepEqual(slugs(cats).slice(1), ['fashion', 'beauty', 'home-kitchen', 'electronics', 'food-pantry', 'kids']);
  for (const c of cats) for (const k of ['id', 'slug', 'name', 'description', 'image', 'parent_id', 'sort', 'is_featured', 'is_active']) assert.ok(k in c, k);
  const all = await api.listProducts();
  assert.equal(all.filter((p) => !p.is_sample && p.category_slug === 'fan-zone').length, 4);
  assert.ok(all.filter((p) => p.is_sample).every((p) => p.image === null));
  assert.equal(all.filter((p) => p.is_popular).length, 4);
});

test('listCategories filters and getCategory', async () => {
  assert.equal((await api.listCategories({ featured: true })).length, 7);
  assert.equal((await api.listCategories({ featured: false })).length, 0);
  assert.equal((await api.getCategory('fan-zone')).name, 'Fan Zone');
  assert.equal(await api.getCategory('nope'), null);
});

test('listProducts extended filters', async () => {
  assert.deepEqual(slugs(await api.listProducts({ categories: ['kids'] })).sort(), ['sample-building-blocks', 'sample-picture-book']);
  assert.equal((await api.listProducts({ categories: ['kids', 'beauty'] })).length, 4);
  const cheap = await api.listProducts({ maxPrice: 10 });
  assert.ok(cheap.length && cheap.every((p) => p.price <= 10));
  const mid = await api.listProducts({ minPrice: 15, maxPrice: 20 });
  assert.ok(mid.length && mid.every((p) => p.price >= 15 && p.price <= 20));
  const inStock = await api.listProducts({ inStock: true });
  assert.ok(!slugs(inStock).includes('sample-cast-iron-pan'));
  assert.ok(slugs(await api.listProducts()).includes('sample-cast-iron-pan'));
  const feat = await api.listProducts({ featured: true });
  assert.ok(feat.length >= 8 && feat.every((p) => p.is_featured));
  const nw = await api.listProducts({ newest: true });
  assert.deepEqual(nw.map((p) => p.created_at), nw.map((p) => p.created_at).slice().sort().reverse());
  assert.equal((await api.listProducts({ page: 2, pageSize: 5 })).length, 5);
});

test('listProductsPaged', async () => {
  const p1 = await api.listProductsPaged({ page: 1, pageSize: 5 });
  assert.equal(p1.items.length, 5); assert.equal(p1.page, 1); assert.equal(p1.pageSize, 5);
  assert.equal(p1.total, (await api.listProducts()).length);
  assert.equal(p1.total, 20);
  const last = await api.listProductsPaged({ page: 4, pageSize: 5 });
  assert.equal(last.items.length, 5);
  assert.equal((await api.listProductsPaged({ page: 5, pageSize: 5 })).items.length, 0);
  const mid = [(await api.listProductsPaged({ page: 2, pageSize: 5 })).items, (await api.listProductsPaged({ page: 3, pageSize: 5 })).items];
  const ids = new Set([...p1.items, ...mid.flat(), ...last.items].map((p) => p.id));
  assert.equal(ids.size, p1.total);
  assert.deepEqual(await api.listProductsPaged({ category: 'nothing' }), { items: [], total: 0, page: 1, pageSize: 12 });
});

test('admin category CRUD requires admin', async () => {
  await rejects(api.adminListCategories(), 'auth');
  await rejects(api.adminUpsertCategory({ name: 'X' }), 'auth');
  await api.signUp({ email: 'u@example.com', password: 'secret1', name: 'U' });
  await rejects(api.adminUpsertCategory({ name: 'X' }), 'forbidden');
  await rejects(api.adminDeleteCategory('x'), 'forbidden');
  await rejects(api.adminReorderCategories([]), 'forbidden');
});

test('adminUpsertCategory create, update, validation, inactive hidden', async () => {
  await asAdmin();
  const c = await api.adminUpsertCategory({ name: 'Garden & Patio', description: 'Outdoor', is_featured: true });
  assert.equal(c.slug, 'garden-patio'); assert.equal(c.sort, 7); assert.equal(c.is_active, true);
  await rejects(api.adminUpsertCategory({ name: '  ' }), 'validation');
  await rejects(api.adminUpsertCategory({ name: 'Dup', slug: 'kids' }), 'validation');
  await rejects(api.adminUpsertCategory({ id: 'missing', name: 'Q' }), 'not_found');
  await rejects(api.adminUpsertCategory({ name: 'Orphan', parent_id: 'missing' }), 'validation');
  const u = await api.adminUpsertCategory({ ...c, is_active: false });
  assert.equal(u.is_active, false);
  assert.ok(!slugs(await api.listCategories()).includes('garden-patio'));
  assert.ok(slugs(await api.listCategories({ includeInactive: true })).includes('garden-patio'));
  assert.equal((await api.getCategory('garden-patio')).slug, 'garden-patio'); // admin may see it
  await api.signOut();
  assert.equal(await api.getCategory('garden-patio'), null);
});

test('parent tree, loop refused, parent filter includes children', async () => {
  await asAdmin();
  const kids = await api.getCategory('kids');
  const toys = await api.adminUpsertCategory({ name: 'Toys', parent_id: kids.id });
  await rejects(api.adminUpsertCategory({ ...kids, parent_id: toys.id }), 'validation');
  await rejects(api.adminUpsertCategory({ ...kids, parent_id: kids.id }), 'validation');
  const p = await api.adminUpsertProduct({ name: 'Wooden Car', price: 8, stock: 5, category_slug: 'toys' });
  assert.ok(slugs(await api.listProducts({ category: 'kids' })).includes(p.slug));
  assert.equal((await api.listProducts({ category: 'toys' })).length, 1);
});

test('slug rename moves products; product is_featured and category validation', async () => {
  await asAdmin();
  const kids = await api.getCategory('kids');
  await api.adminUpsertCategory({ ...kids, slug: 'children' });
  assert.equal((await api.listProducts({ category: 'children' })).length, 2);
  assert.equal((await api.listProducts({ category: 'kids' })).length, 0);
  const p = await api.adminUpsertProduct({ name: 'Star Item', price: 3, stock: 1, category_slug: 'children', is_featured: true });
  assert.equal(p.is_featured, true);
  await rejects(api.adminUpsertProduct({ name: 'Bad', price: 3, category_slug: 'nope' }), 'validation');
});

test('adminDeleteCategory refuses when used, reassigns when asked', async () => {
  await asAdmin();
  const kids = await api.getCategory('kids'); const fashion = await api.getCategory('fashion');
  await assert.rejects(api.adminDeleteCategory(kids.id), (e) => e.code === 'validation' && e.reason === 'in_use' && e.product_count === 2);
  await rejects(api.adminDeleteCategory(kids.id, { reassignTo: kids.id }), 'validation');
  const r = await api.adminDeleteCategory(kids.id, { reassignTo: fashion.id });
  assert.deepEqual(r, { deleted: true, reassigned: 2 });
  assert.equal(await api.getCategory('kids'), null);
  assert.equal((await api.listProducts({ category: 'fashion' })).length, 4);
  const empty = await api.adminUpsertCategory({ name: 'Empty' });
  assert.equal((await api.adminDeleteCategory(empty.id)).reassigned, 0);
  await rejects(api.adminDeleteCategory('missing'), 'not_found');
});

test('adminListCategories counts, adminReorderCategories', async () => {
  await asAdmin();
  const list = await api.adminListCategories();
  assert.equal(list.find((c) => c.slug === 'fan-zone').product_count, 8);
  const ids = list.map((c) => c.id).reverse();
  const out = await api.adminReorderCategories(ids);
  assert.deepEqual(out.map((c) => c.id), ids);
  assert.deepEqual((await api.listCategories()).map((c) => c.id), ids);
  const partial = await api.adminReorderCategories([ids[3]]);
  assert.equal(partial[0].id, ids[3]);
  assert.equal(partial.length, ids.length);
});

test('uploadCategoryImage stores an image and rejects non-images', async () => {
  await asAdmin();
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: 'image/png' });
  const up = await api.uploadCategoryImage(png);
  assert.ok(up.url && up.value);
  const c = await api.adminUpsertCategory({ name: 'Pictured', image: up.value });
  assert.equal(c.image, up.url);
  await rejects(api.uploadCategoryImage(new Blob(['hello'], { type: 'text/plain' })), 'validation');
  await rejects(api.uploadCategoryImage(new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'video/webm' })), 'validation');
});

test('HOME_SLIDES default config', () => {
  const s = globalThis.JPS_CONFIG.HOME_SLIDES;
  assert.ok(Array.isArray(s) && s.length === 3);
  assert.deepEqual(s.map((x) => x.id), ['brand', 'offer', 'fan-zone']);
});

test('SQL: honest seed and migration merged', async () => {
  const { readFileSync } = await import('node:fs');
  const schema = readFileSync(new URL('../../sql/schema.sql', import.meta.url), 'utf8');
  const mig = readFileSync(new URL('../../sql/migrations/004_categories_collections.sql', import.meta.url), 'utf8');
  assert.ok(schema.includes(mig.trim()));
  for (const slug of ['haiti-flag', 'haiti-fan-tee', 'haiti-cap', 'haiti-wristband-set']) assert.ok(!schema.includes(`'${slug}'`), slug);
  assert.equal((schema.match(/^ \('00000000-0000-4000-8000-0000000001\d\d'/gm) || []).length, 4);
  assert.ok(!/eyJ|service_role\s*key|sk_(live|test)/.test(schema + mig));
});
