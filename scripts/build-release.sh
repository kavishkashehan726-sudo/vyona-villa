#!/usr/bin/env bash
# Assembles the production release from a finished `pnpm build`. CI runs it on main and uploads
# the tarball; scripts/deploy-app.sh takes it to the server, where PM2 runs it.
#
# Run it on glibc Linux x64, like the server (CI's ubuntu runner): the native parts (sharp, the
# Prisma schema engine) are the ones installed here.
#
#   web/      Next standalone, node apps/web/server.js
#   admin/    Next standalone, node apps/admin/server.js
#   worker/   worker.mjs, one esbuild bundle (Prisma's query compiler is inlined as WASM)
#   db/       seed.mjs and media-import.mjs bundles, prisma/ (schema, migrations) and a
#             node_modules holding only the Prisma CLI (migrate deploy) and sharp (photo import)
#   REVISION  the commit
#
# Usage: scripts/build-release.sh [out-dir]   default .release/vyona, plus <out-dir>.tar.gz
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/.release/vyona}"
cd "$ROOT"
rm -rf "$OUT" "$OUT.tar.gz"
mkdir -p "$OUT/worker" "$OUT/db"

for app in web admin; do
  next="apps/$app/.next"
  [ -f "$next/standalone/apps/$app/server.js" ] || { echo "✗ apps/$app is not built: run pnpm build first"; exit 1; }
  mkdir -p "$OUT/$app"
  cp -a "$next/standalone/." "$OUT/$app/"
  cp -a "$next/static" "$OUT/$app/apps/$app/.next/static"
done

# ESM bundles; the banner gives bundled CommonJS packages a working require().
esb=(pnpm exec esbuild --bundle --platform=node --format=esm --target=node24 --log-level=warning
  "--banner:js=import{createRequire}from'node:module';const require=createRequire(import.meta.url);")
"${esb[@]}" apps/worker/src/index.ts --outfile="$OUT/worker/worker.mjs"
"${esb[@]}" packages/db/src/seed.ts packages/db/src/media-import.ts --external:sharp \
  --outdir="$OUT/db" --out-extension:.js=.mjs

cp -a packages/db/prisma packages/db/prisma.config.ts "$OUT/db/"
version() { node -p "require('./packages/db/node_modules/$1/package.json').version"; }
cat > "$OUT/db/package.json" <<EOF
{
  "private": true,
  "type": "module",
  "dependencies": { "prisma": "$(version prisma)", "sharp": "$(version sharp)" },
  "pnpm": { "onlyBuiltDependencies": ["@prisma/engines", "prisma", "sharp"] }
}
EOF
# A plain node_modules (hoisted, copied, no store links), so the folder works on its own.
(cd "$OUT/db" && pnpm install --prod --ignore-workspace --no-frozen-lockfile --config.lockfile=false \
  --config.node-linker=hoisted --config.package-import-method=copy --reporter=silent)

echo "${GITHUB_SHA:-$(git rev-parse HEAD)}" > "$OUT/REVISION"

# The repo is public and so is this artifact: nothing but code may go in.
leaks=$(find "$OUT" \( -name '.env*' -o -name '*.webp' -o -name '*.jpg' -o -name '*.jpeg' \) -not -path '*/node_modules/*' | head -5)
[ -z "$leaks" ] || { echo "✗ not for a public artifact:"; echo "$leaks"; exit 1; }

tar -czf "$OUT.tar.gz" -C "$(dirname "$OUT")" "$(basename "$OUT")"
echo "✓ $(cut -c1-7 "$OUT/REVISION"): $(du -sh "$OUT" | cut -f1) → $OUT.tar.gz ($(du -h "$OUT.tar.gz" | cut -f1))"
