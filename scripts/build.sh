#!/usr/bin/env bash
# Static-site build for Render (or any host): copies only the public site into dist/ and writes dist/env.js
# from PUBLIC environment variables. Never put secret keys in these variables.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
cp -r *.html css js assets manifest.json sw.js dist/
[ -d js ] && rm -f dist/js/package.json
node -e '
const e = (k) => process.env[k] || "";
for (const k of ["SUPABASE_URL","SUPABASE_ANON_KEY"]) if (!e(k)) console.warn("WARN: " + k + " is empty, the site will run in local demo mode");
if (/^sb_secret_|service_role/.test(e("SUPABASE_ANON_KEY"))) { console.error("ERROR: SUPABASE_ANON_KEY looks like a secret key"); process.exit(1); }
const cfg = { SUPABASE_URL: e("SUPABASE_URL"), SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") };
require("fs").writeFileSync("dist/env.js", "export default " + JSON.stringify(cfg, null, 2) + ";\n");
'
echo "Built dist/ ($(find dist -type f | wc -l) files)"
