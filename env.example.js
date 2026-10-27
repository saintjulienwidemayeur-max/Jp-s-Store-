// Copy to env.js on the server / hosting (do NOT commit real values).
// Only PUBLIC values go here: project URL and the anon (legacy JWT) key.
// NEVER put sb_secret_..., service_role, Stripe or Meshy keys in this file.
export default {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',
  // ADMIN_EMAILS: ['you@example.com'],           // local-mode demo admin only
  // CONTACT: { instagram: 'jpslogistics', whatsapp: '', email: '' },
};
