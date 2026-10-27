// Public runtime configuration. NEVER put secret keys here (anon key only, and only when the DB is ready).
// While SUPABASE_URL and SUPABASE_ANON_KEY are empty, js/api.js runs in local (localStorage) mode.
const root = typeof window !== 'undefined' ? window : globalThis;

root.JPS_CONFIG = root.JPS_CONFIG || {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  ADMIN_EMAILS: ['admin@jpslogistics.me'],
  PAYMENT_METHODS: [
    { id: 'moncash', label: 'MonCash', enabled: true, instructions_key: 'order.instructions.moncash',
      instructions: 'Send the total via MonCash and include your order number as the reference. We confirm your order once the payment is received.' },
    { id: 'zelle', label: 'Zelle', enabled: true, instructions_key: 'order.instructions.zelle',
      instructions: 'Send the total via Zelle and put your order number in the memo. We confirm your order once the payment is received.' },
    { id: 'cash_on_delivery', label: 'Cash on delivery', enabled: true, instructions_key: 'order.instructions.cash_on_delivery',
      instructions: 'Pay in cash when your order is delivered. We will contact you to arrange the delivery.' },
    { id: 'card_soon', label: 'Credit / debit card', enabled: false, instructions_key: 'order.instructions.card_soon',
      instructions: 'Card payments are coming soon.' }
  ],
  CONTACT: { instagram: 'jpslogistics', whatsapp: '', email: '' },
  CURRENCY: 'USD'
};
