import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../../js/api.js';

const rejects = (p, code) => assert.rejects(p, (e) => e.code === code);
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)));
const MP4 = [0, 0, 0, 0x18, ...[...'ftypisom'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0];
const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8];
const GLB = [...'glTF'].map((c) => c.charCodeAt(0)).concat([2, 0, 0, 0, 20, 0, 0, 0]);
const file = (bytes, name, type, pad = 0) => new File([new Uint8Array([...bytes, ...new Array(pad).fill(1)])], name, { type });
let p;

beforeEach(async () => {
  api._resetLocalForTests();
  await api.signOut();
  p = await api.getProduct('haiti-scarf');
});
const asAdmin = () => api.signIn({ email: 'admin@jpslogistics.me', password: 'admin123' });

test('sniffMedia recognizes magic bytes only', () => {
  assert.equal(api.sniffMedia(JPEG).mime, 'image/jpeg');
  assert.equal(api.sniffMedia(PNG).mime, 'image/png');
  assert.equal(api.sniffMedia(WEBP).mime, 'image/webp');
  assert.equal(api.sniffMedia(MP4).mime, 'video/mp4');
  assert.equal(api.sniffMedia(WEBM).mime, 'video/webm');
  assert.equal(api.sniffMedia(GLB).type, 'model3d');
  assert.equal(api.sniffMedia([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]), null);
  assert.equal(api.sniffMedia(new Uint8Array(0)), null);
});

test('seed products have derived media', async () => {
  assert.equal(p.media.length, 1);
  assert.equal(p.media[0].type, 'image');
  assert.equal(p.media[0].is_cover, true);
  assert.equal(p.media[0].url, p.image);
  const flag = await api.getProduct('haiti-flag');
  assert.deepEqual(flag.media, []);
  assert.equal(flag.image, null);
});

test('uploadMedia is admin only', async () => {
  await rejects(api.uploadMedia(p.id, file(JPEG, 'a.jpg', 'image/jpeg')), 'auth');
  await api.signUp({ email: 'u@example.com', password: 'secret1', name: 'U' });
  await rejects(api.uploadMedia(p.id, file(JPEG, 'a.jpg', 'image/jpeg')), 'forbidden');
});

test('uploadMedia validation: magic bytes, declared type, size, empty', async () => {
  await asAdmin();
  await rejects(api.uploadMedia(p.id, file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0], 'a.jpg', 'image/jpeg')), 'validation'); // gif renamed
  await rejects(api.uploadMedia(p.id, file([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'x.png', 'image/png')), 'validation');
  await rejects(api.uploadMedia(p.id, file(JPEG, 'a.png', 'image/png')), 'validation'); // declared mismatch
  await rejects(api.uploadMedia(p.id, new File([], 'e.jpg', { type: 'image/jpeg' })), 'validation');
  await rejects(api.uploadMedia(p.id, file(PNG, 'big.png', 'image/png', 8 * 1024 * 1024)), 'validation'); // > 8 MB image
  await rejects(api.uploadMedia(p.id, file(GLB, 'm.glb', '', 30 * 1024 * 1024)), 'validation'); // > 30 MB glb
  await rejects(api.uploadMedia(p.id, null), 'validation');
  await rejects(api.uploadMedia('nope', file(JPEG, 'a.jpg', 'image/jpeg')), 'not_found');
  assert.equal((await api.getProduct('haiti-scarf')).media.length, 1);
  // an extensionless/octet-stream file is accepted when the bytes are valid
  const ok = await api.uploadMedia(p.id, file(PNG, 'blob', 'application/octet-stream'), { alt: 'x' });
  assert.equal(ok.type, 'image');
  const vid = await api.uploadMedia(p.id, file(MP4, 'v.mp4', 'video/mp4'));
  assert.equal(vid.type, 'video');
  assert.equal(vid.job, undefined);
  const glb = await api.uploadMedia(p.id, file(GLB, 'm.glb', 'model/gltf-binary'));
  assert.equal(glb.type, 'model3d');
  assert.equal(glb.source, 'upload');
});

test('cover, reorder, delete', async () => {
  await asAdmin();
  const flag = await api.getProduct('haiti-flag');
  const a = await api.uploadMedia(flag.id, file(JPEG, 'a.jpg', 'image/jpeg'), { alt: 'A' });
  const v = await api.uploadMedia(flag.id, file(MP4, 'v.mp4', 'video/mp4'));
  const b = await api.uploadMedia(flag.id, file(PNG, 'b.png', 'image/png'));
  let cur = await api.getProduct(flag.id);
  assert.equal(a.alt, 'A');
  assert.equal(cur.media.filter((m) => m.is_cover).length, 1);
  assert.equal(cur.media.find((m) => m.id === a.id).is_cover, true); // first image becomes cover
  assert.equal(cur.image, a.url);
  assert.match(cur.image, /^(blob:|data:)/);

  await rejects(api.setCover(flag.id, v.id), 'validation');
  await rejects(api.setCover(flag.id, 'nope'), 'not_found');
  await api.setCover(flag.id, b.id);
  cur = await api.getProduct(flag.id);
  assert.equal(cur.image, b.url);
  assert.deepEqual(cur.images, [b.url, a.url]);

  const ids = cur.media.map((m) => m.id);
  const rev = [...ids].reverse();
  const out = await api.reorderMedia(flag.id, rev);
  assert.ok(out.map((m) => m.id).slice(0, rev.length).join() === rev.join());
  assert.deepEqual(out.map((m) => m.sort), out.map((_, i) => i));
  await rejects(api.reorderMedia(flag.id, ['nope']), 'validation');
  await rejects(api.reorderMedia(flag.id, [ids[0], ids[0]]), 'validation');
  // partial list: listed first, rest keep order
  const part = await api.reorderMedia(flag.id, [v.id]);
  assert.equal(part[0].id, v.id);

  await api.deleteMedia(flag.id, b.id); // deleting the cover promotes another image
  cur = await api.getProduct(flag.id);
  assert.ok(!cur.media.some((m) => m.id === b.id));
  assert.ok(!cur.media.some((m) => m.type === 'model3d' && m.source_media_id === b.id)); // cascades generated 3D
  assert.equal(cur.media.find((m) => m.is_cover).id, a.id);
  await rejects(api.deleteMedia(flag.id, b.id), 'not_found');
  await api.deleteMedia(flag.id, a.id);
  cur = await api.getProduct(flag.id);
  assert.equal(cur.image, null);
  assert.deepEqual(cur.images, []);
  assert.equal(cur.media.length, 1); // the video remains
});

test('3D job lifecycle in local mode', async () => {
  await asAdmin();
  const flag = await api.getProduct('haiti-flag');
  const a = await api.uploadMedia(flag.id, file(JPEG, 'a.jpg', 'image/jpeg'));
  assert.equal(a.job.status, 'succeeded'); // AUTO_3D default true
  let cur = await api.getProduct(flag.id);
  const m3 = cur.media.filter((m) => m.type === 'model3d');
  assert.equal(m3.length, 1);
  assert.equal(m3[0].url, null);
  assert.equal(m3[0].fallback, 'tilt');
  assert.equal(m3[0].source, 'generated');
  assert.equal(m3[0].status, 'ready');
  assert.equal(m3[0].poster, a.url);
  assert.equal(cur.images.length, 1); // 3D item doesn't leak into images

  const job = await api.get3DJob(a.job.id);
  assert.equal(job.result_media_id, m3[0].id);
  assert.equal((await api.list3DJobs(flag.id)).length, 1);
  assert.equal(await api.get3DJob('nope'), null);

  const again = await api.request3D(flag.id, a.id); // regenerate replaces
  assert.equal(again.status, 'succeeded');
  cur = await api.getProduct(flag.id);
  assert.equal(cur.media.filter((m) => m.type === 'model3d').length, 1);
  assert.notEqual(cur.media.find((m) => m.type === 'model3d').id, m3[0].id);
  assert.equal((await api.list3DJobs(flag.id)).length, 1);

  const vid = await api.uploadMedia(flag.id, file(MP4, 'v.mp4', 'video/mp4'));
  await rejects(api.request3D(flag.id, vid.id), 'validation');
  await rejects(api.request3D(flag.id, 'nope'), 'not_found');
  await rejects(api.request3D('nope', a.id), 'not_found');

  await api.deleteMedia(flag.id, a.id);
  assert.equal((await api.list3DJobs(flag.id)).length, 0);
  await api.signOut();
  await rejects(api.request3D(flag.id, a.id), 'auth');
  await rejects(api.get3DJob(job.id), 'auth');
});

test('AUTO_3D=false skips the automatic job', async () => {
  await asAdmin();
  globalThis.JPS_CONFIG.AUTO_3D = false;
  try {
    const flag = await api.getProduct('haiti-flag');
    const a = await api.uploadMedia(flag.id, file(JPEG, 'a.jpg', 'image/jpeg'));
    assert.equal(a.job, undefined);
    assert.equal((await api.list3DJobs(flag.id)).length, 0);
  } finally { globalThis.JPS_CONFIG.AUTO_3D = true; }
});

test('adminUpsertProduct keeps media; new product from images gets media', async () => {
  await asAdmin();
  const flag = await api.getProduct('haiti-flag');
  await api.uploadMedia(flag.id, file(JPEG, 'a.jpg', 'image/jpeg'));
  const edited = await api.adminUpsertProduct({ ...(await api.getProduct(flag.id)), name: 'Haiti Flag XL' });
  assert.equal(edited.name, 'Haiti Flag XL');
  assert.equal(edited.media.filter((m) => m.type === 'image').length, 1);
  const np = await api.adminUpsertProduct({ name: 'Mug', price: 5, image: 'assets/img/x.jpg', category_slug: 'fan-zone' });
  assert.equal(np.media.length, 1);
  assert.equal(np.image, 'assets/img/x.jpg');
});

test('preferences', async () => {
  assert.deepEqual(await api.getPreferences(), { lang: 'en' });
  assert.deepEqual(await api.setPreferences({ lang: 'ht' }), { lang: 'ht' });
  assert.equal((await api.getPreferences()).lang, 'ht');
  await rejects(api.setPreferences({ lang: 'de' }), 'validation');
  await rejects(api.setPreferences({ theme: 'x' }), 'validation');
  await rejects(api.setPreferences(null), 'validation');
  assert.equal((await api.getPreferences()).lang, 'ht');
});
