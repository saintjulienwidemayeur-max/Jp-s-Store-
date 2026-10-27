# JP's Logistics & More — Store (SPEC / contract between agents)

Brand: **JP's Logistics & More**, Haitian fan-zone merch store (World Cup 2026). Mobile-first (video is a phone screen).
Instagram: @jpslogistics · Domain seen in video: store.jpslogistics.me

## Brand tokens (from video + logo)
- Navy/royal blue `#1F2F9E` (logo), deep `#0D2B80`, Haiti red `#D21034`, accent orange `#F26B3A` (coupon highlight, "Shipping included" badge), white `#FFFFFF`, page bg `#FCFBFE`, ink `#111`.
- Fonts: Poppins (UI/body, Google Fonts), logo wordmark uses serif caps (use assets/brand/logo.png).
- Look: white header with burger (left), logo center-left, search icon (right); product cards = rounded image tile, heart (wishlist) top-right, name, 5 gold stars, bold price; section titles "Browse by Categories", "Most Popular"; 4 value props with icons: Quality & Savings, Fast Delivery, Secure Payment, Professional Service. Promo hero banner "Fierté de la nation haïtienne — produits haïtiens de collection". Promo strip: **Use code HT26 for 15% off purchases over $10 — Shipping included.**

## Stack (no build step)
Static HTML + ES modules + vanilla CSS/JS. Served by `node server.js` (zero deps, port 8080). Tests: `node --test tests/unit` (unit) and Playwright (`tests/e2e`, Playwright is globally installed: `require('playwright')`).
Database: **Supabase (Postgres) is the only database, connected later by the owner.** Until `js/config.js` has `SUPABASE_URL` + `SUPABASE_ANON_KEY`, `js/api.js` runs in `local` mode (localStorage + seed data) with the exact same API, so the whole site works and is testable offline. NEVER hardcode keys.

## Files & ownership
```
index.html shop.html product.html cart.html checkout.html order.html account.html wishlist.html info.html(about/contact/faq/shipping/returns via ?p=) 404.html admin.html
css/styles.css                 (frontend)
js/config.js                   (backend)  window.JPS_CONFIG
js/api.js                      (backend)  data layer, THE ONLY module that touches storage/Supabase
js/pricing.js                  (backend)  pure totals/coupon math
js/seed.js                     (backend)  seed products/categories/coupons
js/i18n.js                     (frontend) EN/FR/HT dictionaries, t(key), setLang
js/layout.js                   (frontend) injects header/drawer/search/footer/promo strip/toasts/cart badge
js/cart.js                     (frontend) cart store (localStorage key jps_cart_v1)
js/pages/*.js                  (frontend) one module per page
sql/schema.sql                 (backend)  tables + RLS + seed, run in Supabase SQL editor
server.js package.json         (backend)
tests/unit, tests/e2e          (qa)
manifest.json sw.js            (frontend) PWA, offline shell
```

## js/pricing.js (pure, ES module)
- `COUPON_DEFAULT = {code:'HT26', percent:15, min_subtotal:10}`
- `roundMoney(n)`; `computeTotals(lines, coupon|null)` → `{subtotal, discount, shipping:0, total, couponApplied:boolean, couponReason:null|'min_subtotal'|'invalid'|'expired'}`. `lines = [{unit_price, qty}]`. Shipping is ALWAYS 0 ("Shipping included"). Coupon applies only when `subtotal > min_subtotal` (video: "purchases of over $10"). Discount = roundMoney(subtotal*percent/100). All money in dollars with 2 decimals, formatted by `formatMoney(n)` → `$17.99`.

## js/api.js (ES module, all async, same signatures in local + supabase mode)
```
export const mode            // 'local' | 'supabase'
// catalog
listCategories() -> [{id,slug,name,image}]
listProducts({category?, q?, sort?:'popular'|'price_asc'|'price_desc'|'new', limit?, includeInactive?}) -> Product[]
getProduct(slugOrId) -> Product|null
// Product: {id,slug,name,description,price,compare_at_price|null,category_slug,image,images[],rating(0-5),review_count,stock,is_active,is_popular,tags[]}
// coupons
validateCoupon(code, subtotal) -> {valid, coupon|null, reason|null}   // case-insensitive
// orders
placeOrder({customer:{name,email,phone,address,city,country,notes}, items:[{product_id,qty}], coupon_code?, payment_method}) -> Order
   // server-side recompute of prices from catalog; decrements stock; returns {id, order_number:'JPS-YYMMDD-XXXX', status:'pending', items[], subtotal,discount,shipping,total,coupon_code,created_at,customer,payment_method}
getOrder(orderNumber, email) -> Order|null          // guest tracking requires matching email
listMyOrders() -> Order[]                           // current user
// wishlist (works for guests via localStorage, syncs to table when logged in)
getWishlist() -> string[] (product ids); toggleWishlist(productId) -> boolean(now in list)
// auth
signUp({email,password,name}), signIn({email,password}), signOut(), getUser() -> {id,email,name,is_admin}|null, onAuthChange(cb)
// reviews
listReviews(productId), addReview({product_id,rating,comment})  (logged-in only)
// newsletter/contact
subscribeNewsletter(email), sendContactMessage({name,email,message})
// admin (is_admin only; local mode: user with email in JPS_CONFIG.ADMIN_EMAILS, default admin@jpslogistics.me / password "admin123" seeded in local mode ONLY)
adminListOrders({status?}), adminUpdateOrderStatus(id,status)  // pending|paid|processing|shipped|delivered|cancelled
adminUpsertProduct(product), adminDeleteProduct(id), adminListCoupons(), adminUpsertCoupon(c), adminStats() -> {orders,revenue,products,lowStock[]}
```
Errors: throw `Error` with `.code` in `'out_of_stock'|'invalid_coupon'|'validation'|'auth'|'not_found'|'forbidden'`.

## Seed catalog (from the video — prices exact)
Category: `fan-zone` "Fan Zone" (image assets/img/headband.jpg).
| slug | name | price | image | popular |
|---|---|---|---|---|
| haiti-face-tattoo | Haiti Face Tattoo | 7.99 | assets/img/face-tattoo.jpg | yes |
| haiti-headband | Haiti Headband | 9.99 | assets/img/headband.jpg | yes |
| haiti-scarf | Haiti Scarf | 17.99 | assets/img/scarf.jpg | yes |
| haiti-thunder-stick | Haiti Thunder Stick | 14.99 | assets/img/thunder-stick.jpg | yes |
Write good descriptions. Add a few extra Haitian-fan items (flag, jersey-style tee, cap, wristband) with `image: null` → UI renders a branded placeholder (blue tile with logo). Extras are `is_popular:false`. Coupon HT26.

## Frontend rules
- Semantic HTML, accessible (labels, aria, focus rings, alt text), responsive 360px→desktop, no horizontal scroll, prefers-reduced-motion respected, dark mode NOT required.
- Languages EN (default) / FR / HT-Kreyòl with a switcher in the drawer + footer; persisted `jps_lang`. All visible strings via `t()`.
- Each page: `<script type="module" src="js/pages/<page>.js">`; every page imports `layout.js` which mounts chrome. Pages must work with `file://`-free static server and show empty/loading/error states.
- Checkout payment methods (config `JPS_CONFIG.PAYMENT_METHODS`): `moncash`, `zelle`, `cash_on_delivery`, `card_soon` (disabled, "coming soon"). Order is created `pending`; confirmation page shows instructions per method. No card data is ever collected.
- Money always via `formatMoney`. Cart badge in header. Free shipping messaging everywhere relevant.

## Frontend shared API (so two frontend agents can work in parallel)
- `js/i18n.js`: `t(key, vars?)`, `getLang()`, `setLang(l)`, `addMessages(lang, obj)` (flat dotted keys). Core owns common keys (nav.*, common.*, home.*, shop.*, product.*, footer.*). Commerce owns `js/i18n.commerce.js` (keys cart.*, checkout.*, order.*, account.*, admin.*) which calls `addMessages` for en/fr/ht and is imported by its pages.
- `js/layout.js`: auto-mounts on import; exports `toast(msg, type='info')`, `escapeHtml(s)`, `productCardHTML(product)` (shared card with heart + stars + price), `bindProductCards(root)` (wishlist heart + add-to-cart handlers).
- `js/cart.js`: `getCart()` -> `[{product_id,slug,name,price,image,qty}]`, `addItem(product, qty=1)`, `setQty(product_id, qty)`, `removeItem(product_id)`, `clearCart()`, `cartCount()`, `onCartChange(cb)`; also dispatches `window` event `jps:cart`.
- CSS: `css/styles.css` (core: tokens as CSS variables `--blue --blue-deep --red --orange --bg --ink --muted --radius --shadow`, header, drawer, buttons `.btn .btn-primary .btn-outline`, cards, forms `.field`, grid utils `.container .grid`, footer). Commerce adds `css/commerce.css` (cart/checkout/order/account) and `css/admin.css`; they only use core classes/variables, never edit styles.css.
- Every page links `css/styles.css`, and page-specific css after it.

---
# ADDENDUM 2 — Product media, auto 3D, Settings (language)

## Media model
`Product.media = [{id, type:'image'|'video'|'model3d', url, poster|null, alt, sort, is_cover:boolean, source:'upload'|'generated', status?:'ready'|'queued'|'processing'|'failed'}]`. `Product.image`/`images[]` remain for backward compat (derived: cover + images). Existing seed products get media from their image paths.
- Limits: images ≤ 8 MB (jpeg/png/webp), videos ≤ 50 MB (mp4/webm), GLB ≤ 30 MB. Validate type+size client side AND in storage policy. Never trust file extension only (sniff magic bytes).
- api.js additions (same local/supabase dual mode): `uploadMedia(productId, File, {alt}) -> mediaItem` (supabase: Storage bucket `product-media`, public read, admin-only write; local: IndexedDB blob store `jps_media`, URLs via object URL/dataURL), `deleteMedia(productId, mediaId)`, `reorderMedia(productId, ids[])`, `setCover(productId, mediaId)`, `request3D(productId, mediaId) -> job {id,status}` (admin; also auto-called by uploadMedia for type image when `JPS_CONFIG.AUTO_3D !== false`), `get3DJob(jobId)`, `list3DJobs(productId)`.
## 3D generation
- Real image-to-3D needs an AI service. Production path: Supabase Edge Function `supabase/functions/generate-3d/index.ts` (Deno) calls the configured provider (default **Meshy** image-to-3D; keep provider adapter so Tripo/others can be swapped), keys only in Supabase secrets (`MESHY_API_KEY`), never in the browser. Flow: admin upload image -> row in `product_3d_jobs` (queued) -> function creates task, polls/webhooks, downloads GLB into storage `product-media/models/`, inserts a `model3d` media item (ready) -> storefront shows it. Research the provider's current API with WebSearch/WebFetch and write the adapter against the real docs; document required secrets + cost caveats in `docs/3D.md`.
- Local mode / no key configured: `request3D` creates a job that finishes immediately with `source:'generated'`, `type:'model3d'` item whose `url` is null and `fallback:'tilt'` (storefront renders the on-device pseudo-3D tilt/parallax viewer from the photo). Clearly label in UI: "Preview 3D (on-device)" vs "3D model (AI)".
- Storefront viewer `js/viewer3d.js`: if media item has a GLB url -> use `<model-viewer>` (load `https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js` lazily as a module only when needed; AR button allowed; camera-controls, auto-rotate, poster = cover image, loading state, error fallback to tilt viewer); if fallback 'tilt' -> pointer/gyro-free CSS 3D tilt card with shine on the cover photo. Respect prefers-reduced-motion.
## Product gallery
Product page gallery shows images, videos (native `<video controls playsinline preload="metadata" poster>`; muted loop optional), and a "3D" tab/thumbnail; keyboard accessible thumbnails; swipe on mobile; lightbox zoom for images. Product cards use cover image. Admin product form gets a Media manager: multi-file upload with progress, drag-drop, reorder (also with up/down buttons for a11y), set cover, alt text, delete, 3D status badge per image + "Generate 3D" / "Regenerate" button, and "Upload my own .glb".
## Settings / language
New `settings.html` (+ `js/pages/settings.js`, strings `settings.*`): language selector (EN/FR/HT, as radio cards with native names Français / Kreyòl ayisyen / English), preview of current language, plus currency display note (USD only), reduced-motion note, clear local data (wishlist/cart) buttons with in-page confirm. Language is a *preference*: `api.getPreferences()` / `api.setPreferences({lang})` (local: localStorage `jps_lang`; supabase: `profiles.preferences jsonb` when logged in, still mirrored to localStorage so it works for guests). Header drawer keeps a "Settings" link (gear icon) and the language switcher moves OUT of the drawer/footer into Settings (footer keeps a small "Language: Kreyòl · Change" link to settings.html). `setLang` stays in i18n.js and must read the preference.
## Ownership
Backend agent: js/api.js, js/seed.js, js/config.js (AUTO_3D, MEDIA limits), sql/schema.sql (additive migration `sql/migrations/002_media_3d_settings.sql` AND merged into schema.sql: products.media jsonb, product_3d_jobs, storage bucket + policies, profiles.preferences), supabase/functions/generate-3d/index.ts, docs/3D.md, unit tests.
Frontend agent: js/viewer3d.js, css/media.css, settings.html, js/pages/settings.js, js/pages/product.js (gallery), js/pages/admin.js (media manager), js/layout.js/i18n*.js (drawer/footer language move + new keys EN/FR/HT), sw.js shell list, manifest untouched.
