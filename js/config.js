// Public runtime configuration. NEVER put secret keys here (anon key only, and only when the DB is ready).
// While SUPABASE_URL and SUPABASE_ANON_KEY are empty, js/api.js runs in local (localStorage) mode.
const root = typeof window !== 'undefined' ? window : globalThis;

root.JPS_CONFIG = root.JPS_CONFIG || {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  ADMIN_EMAILS: ['admin@jpslogistics.me'],
  // Debit card is the primary/default method (Stripe-hosted Checkout, redirect). The site never sees card data.
  // The others are secondary: set enabled:false to switch one off. First enabled `default:true` is preselected.
  PAYMENT_METHODS: [
    { id: 'debit_card', label: 'Debit card', enabled: true, default: true, provider: 'stripe',
      brands: ['visa', 'mastercard', 'amex', 'discover'],
      description: 'Pay securely with your debit card (Visa, Mastercard and more) on Stripe\'s hosted payment page.',
      instructions_key: 'order.pay.debit_card',
      instructions: 'Pay by debit card on Stripe\'s secure payment page. We never see your card details.' },
    { id: 'moncash', label: 'MonCash', enabled: true, instructions_key: 'order.instructions.moncash',
      instructions: 'Send the total via MonCash and include your order number as the reference. We confirm your order once the payment is received.' },
    { id: 'zelle', label: 'Zelle', enabled: true, instructions_key: 'order.instructions.zelle',
      instructions: 'Send the total via Zelle and put your order number in the memo. We confirm your order once the payment is received.' },
    { id: 'cash_on_delivery', label: 'Cash on delivery', enabled: true, instructions_key: 'order.instructions.cash_on_delivery',
      instructions: 'Pay in cash when your order is delivered. We will contact you to arrange the delivery.' }
  ],
  // Card payments: Stripe Checkout (redirect), session created by the Supabase Edge Function `create-checkout`.
  // Secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) live ONLY in Supabase secrets. See docs/PAYMENTS.md.
  PAYMENTS: { provider: 'stripe', function: 'create-checkout' },
  CONTACT: { instagram: 'jpslogistics', whatsapp: '', email: '' },
  CURRENCY: 'USD',
  // Media / 3D knobs (public, safe in the browser). Secrets (MESHY_API_KEY...) live ONLY in Supabase secrets.
  AUTO_3D: true,                         // uploadMedia(image) auto-requests a 3D job unless false
  MEDIA_BUCKET: 'product-media',
  MEDIA_LIMITS: { image: 8 * 1024 * 1024, video: 50 * 1024 * 1024, model3d: 30 * 1024 * 1024 },
  FUNCTION_3D: 'generate-3d'             // Supabase Edge Function name
};

// Deployment overrides (public values only): env.js is replaced at deploy time with the project URL + anon key.
// Kept out of this file on purpose so keys never live in the code. Missing or empty env.js keeps local mode.
try {
  const env = (await import('../env.js')).default || {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_EMAILS', 'CONTACT']) {
    if (env[k] !== undefined && env[k] !== '') root.JPS_CONFIG[k] = env[k];
  }
} catch { /* no env.js: local mode */ }
