// Seed data for local mode; sql/schema.sql mirrors it (same UUIDs/slugs).
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const SEED_CATEGORIES = [
  { id: uid(1), slug: 'fan-zone', name: 'Fan Zone', image: 'assets/img/headband.jpg' }
];

const P = (n, slug, name, description, price, image, popular, stock, tags, compare = null) => ({
  id: uid(100 + n), slug, name, description, price, compare_at_price: compare,
  category_slug: 'fan-zone', image, images: image ? [image] : [],
  rating: 5, review_count: 0, stock, is_active: true, is_popular: popular, tags,
  created_at: new Date(Date.UTC(2026, 4, 1 + n)).toISOString()
});

export const SEED_PRODUCTS = [
  P(1, 'haiti-face-tattoo', 'Haiti Face Tattoo',
    'Show your colors from the first whistle. Skin-safe temporary face tattoos in the blue and red of Haiti, easy to apply and easy to remove. Perfect for match day and fan-zone parties.',
    7.99, 'assets/img/face-tattoo.jpg', true, 200, ['face', 'tattoo', 'sticker', 'match day']),
  P(2, 'haiti-headband', 'Haiti Headband',
    'A soft, stretchy headband in Haiti blue and red. Keeps the sweat out of your eyes and the pride on your head. One size fits most.',
    9.99, 'assets/img/headband.jpg', true, 150, ['headband', 'accessory', 'blue', 'red']),
  P(3, 'haiti-scarf', 'Haiti Scarf',
    'Wave it, wear it, sing with it. A collectible supporter scarf in the colors of Haiti, warm, soft and made for the stands.',
    17.99, 'assets/img/scarf.jpg', true, 100, ['scarf', 'collectible', 'supporter']),
  P(4, 'haiti-thunder-stick', 'Haiti Thunder Stick',
    'Make some noise for the Grenadiers. Inflatable thunder sticks in Haiti colors: bang them together to lead the chant. Light, durable and fun for the whole crowd.',
    14.99, 'assets/img/thunder-stick.jpg', true, 120, ['noisemaker', 'thunder stick', 'chant']),
  P(5, 'haiti-flag', 'Haiti Flag',
    'Proud, bold and ready to fly. A durable Haitian flag with reinforced edges and grommets, for the balcony, the car or the stadium.',
    12.99, null, false, 80, ['flag', 'decor', 'blue', 'red']),
  P(6, 'haiti-fan-tee', 'Haiti Fan Tee',
    'A jersey-style fan tee in Haiti blue with red trim. Breathable, comfortable and made to be worn loud on match day.',
    24.99, null, false, 60, ['tee', 'shirt', 'jersey', 'apparel']),
  P(7, 'haiti-cap', 'Haiti Cap',
    'A classic adjustable cap with the colors of Haiti. Shade for the sun, pride for the crowd.',
    15.99, null, false, 70, ['cap', 'hat', 'apparel']),
  P(8, 'haiti-wristband-set', 'Haiti Wristband Set',
    'A set of two sweat-absorbing wristbands in Haiti blue and red. Small piece of gear, big team spirit.',
    5.99, null, false, 150, ['wristband', 'accessory', 'set'])
];

export const SEED_COUPONS = [
  { code: 'HT26', percent: 15, min_subtotal: 10, active: true, expires_at: null }
];
