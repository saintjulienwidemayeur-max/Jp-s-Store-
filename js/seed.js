// Seed data for local mode; sql/schema.sql mirrors it (same UUIDs/slugs).
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// The only REAL collection (mirrors sql/schema.sql). Everything flagged is_sample is local-demo data only, never in the SQL seed.
const C = (n, slug, name, description, sort, extra = {}) => ({
  id: uid(n), slug, name, description, image: null, parent_id: null, sort, is_featured: true, is_active: true, ...extra
});
export const SEED_CATEGORIES = [
  C(1, 'fan-zone', 'Fan Zone', 'Show your colors for World Cup 2026: Haitian fan gear for match day.', 0, { image: 'assets/img/headband.jpg' })
];
export const SAMPLE_CATEGORIES = [
  C(2, 'fashion', 'Fashion', 'Sample category: clothing and accessories.', 1, { is_sample: true }),
  C(3, 'beauty', 'Beauty', 'Sample category: skin, hair and personal care.', 2, { is_sample: true }),
  C(4, 'home-kitchen', 'Home & Kitchen', 'Sample category: for the home and the kitchen.', 3, { is_sample: true }),
  C(5, 'electronics', 'Electronics', 'Sample category: gadgets and accessories.', 4, { is_sample: true }),
  C(6, 'food-pantry', 'Food & Pantry', 'Sample category: pantry staples and treats.', 5, { is_sample: true }),
  C(7, 'kids', 'Kids', 'Sample category: toys and things for little ones.', 6, { is_sample: true })
];

// Deterministic media ids so seed, SQL and runtime agree: 0ed1a000-<index>-<tail of product id>.
export const mediaIdFor = (productId, i) => `0ed1a000-${String(i).padStart(4, '0')}${String(productId).slice(13)}`;
export function mediaFromImages(productId, name, images) {
  return (images || []).filter(Boolean).map((url, i) => ({
    id: mediaIdFor(productId, i), type: 'image', url, poster: null, alt: name, sort: i, is_cover: i === 0,
    source: 'upload', status: 'ready'
  }));
}

const P = (n, slug, name, description, price, image, popular, stock, tags, compare = null, extra = {}) => ({
  id: uid(100 + n), slug, name, description, price, compare_at_price: compare,
  category_slug: 'fan-zone', is_featured: false, image, images: image ? [image] : [],
  media: mediaFromImages(uid(100 + n), name, image ? [image] : []),
  rating: 5, review_count: 0, stock, is_active: true, is_popular: popular, tags,
  created_at: new Date(Date.UTC(2026, 4, 1 + n)).toISOString(), ...extra
});

export const SEED_PRODUCTS = [
  P(1, 'haiti-face-tattoo', 'Haiti Face Tattoo',
    'Show your colors from the first whistle. Skin-safe temporary face tattoos in the blue and red of Haiti, easy to apply and easy to remove. Perfect for match day and fan-zone parties.',
    7.99, 'assets/img/face-tattoo.jpg', true, 200, ['face', 'tattoo', 'sticker', 'match day'], null, { is_featured: true }),
  P(2, 'haiti-headband', 'Haiti Headband',
    'A soft, stretchy headband in Haiti blue and red. Keeps the sweat out of your eyes and the pride on your head. One size fits most.',
    9.99, 'assets/img/headband.jpg', true, 150, ['headband', 'accessory', 'blue', 'red'], null, { is_featured: true }),
  P(3, 'haiti-scarf', 'Haiti Scarf',
    'Wave it, wear it, sing with it. A collectible supporter scarf in the colors of Haiti, warm, soft and made for the stands.',
    17.99, 'assets/img/scarf.jpg', true, 100, ['scarf', 'collectible', 'supporter'], null, { is_featured: true }),
  P(4, 'haiti-thunder-stick', 'Haiti Thunder Stick',
    'Make some noise for the Grenadiers. Inflatable thunder sticks in Haiti colors: bang them together to lead the chant. Light, durable and fun for the whole crowd.',
    14.99, 'assets/img/thunder-stick.jpg', true, 120, ['noisemaker', 'thunder stick', 'chant'], null, { is_featured: true }),
  P(5, 'haiti-flag', 'Haiti Flag',
    'Proud, bold and ready to fly. A durable Haitian flag with reinforced edges and grommets, for the balcony, the car or the stadium.',
    12.99, null, false, 80, ['flag', 'decor', 'blue', 'red'], null, { is_sample: true }),
  P(6, 'haiti-fan-tee', 'Haiti Fan Tee',
    'A jersey-style fan tee in Haiti blue with red trim. Breathable, comfortable and made to be worn loud on match day.',
    24.99, null, false, 60, ['tee', 'shirt', 'jersey', 'apparel'], null, { is_sample: true }),
  P(7, 'haiti-cap', 'Haiti Cap',
    'A classic adjustable cap with the colors of Haiti. Shade for the sun, pride for the crowd.',
    15.99, null, false, 70, ['cap', 'hat', 'apparel'], null, { is_sample: true }),
  P(8, 'haiti-wristband-set', 'Haiti Wristband Set',
    'A set of two sweat-absorbing wristbands in Haiti blue and red. Small piece of gear, big team spirit.',
    5.99, null, false, 150, ['wristband', 'accessory', 'set'], null, { is_sample: true })
];

// Local demo only (clearly sample data so the category UI can be tested). Never mirrored into sql/schema.sql.
const S = (n, cat, slug, name, description, price, stock, tags, extra = {}) => P(n, slug, name, description, price, null, false, stock, tags, null,
  { category_slug: cat, is_sample: true, created_at: new Date(Date.UTC(2026, 5, n)).toISOString(), ...extra });
export const SAMPLE_PRODUCTS = [
  S(11, 'fashion', 'sample-classic-tote', 'Sample Classic Tote', 'Sample product: a roomy everyday tote bag.', 19.99, 40, ['bag', 'tote'], { is_featured: true }),
  S(12, 'fashion', 'sample-denim-jacket', 'Sample Denim Jacket', 'Sample product: a classic denim jacket.', 54.0, 15, ['jacket', 'denim']),
  S(13, 'beauty', 'sample-shea-body-butter', 'Sample Shea Body Butter', 'Sample product: rich, moisturizing body butter.', 12.5, 60, ['skin', 'butter'], { is_featured: true }),
  S(14, 'beauty', 'sample-hair-oil', 'Sample Hair Oil', 'Sample product: nourishing hair oil.', 9.0, 50, ['hair', 'oil']),
  S(15, 'home-kitchen', 'sample-ceramic-mug-set', 'Sample Ceramic Mug Set', 'Sample product: a set of four ceramic mugs.', 22.0, 30, ['mug', 'kitchen'], { is_featured: true }),
  S(16, 'home-kitchen', 'sample-cast-iron-pan', 'Sample Cast Iron Pan', 'Sample product: a seasoned cast iron pan.', 34.99, 0, ['pan', 'cookware']),
  S(17, 'electronics', 'sample-wireless-earbuds', 'Sample Wireless Earbuds', 'Sample product: Bluetooth earbuds with a charging case.', 39.99, 25, ['audio', 'bluetooth'], { is_featured: true }),
  S(18, 'electronics', 'sample-fast-charger', 'Sample Fast Charger', 'Sample product: a compact USB-C fast charger.', 16.99, 80, ['charger', 'usb']),
  S(19, 'food-pantry', 'sample-spice-sampler', 'Sample Spice Sampler', 'Sample product: a sampler of six spice blends.', 14.5, 45, ['spice', 'pantry'], { is_featured: true }),
  S(20, 'food-pantry', 'sample-coffee-beans', 'Sample Coffee Beans', 'Sample product: whole roasted coffee beans, 12 oz.', 11.99, 70, ['coffee', 'beans']),
  S(21, 'kids', 'sample-building-blocks', 'Sample Building Blocks', 'Sample product: a 100-piece block set.', 18.99, 35, ['toy', 'blocks'], { is_featured: true }),
  S(22, 'kids', 'sample-picture-book', 'Sample Picture Book', 'Sample product: a bright illustrated picture book.', 7.5, 55, ['book', 'kids'])
];

export const SEED_COUPONS = [
  { code: 'HT26', percent: 15, min_subtotal: 10, active: true, expires_at: null }
];
