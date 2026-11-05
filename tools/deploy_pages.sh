#!/bin/bash
# Publica o Arcane Chess no Cloudflare Pages (https://arcanechess.pages.dev).
# Uso: tools/deploy_pages.sh <snapshot.html> <pasta-temporária>
# Monta o site com o jogo + os assets servidos (mp3 e .gltf.json) e envia com o wrangler.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP="$1"; W="$2/cf-site"
rm -rf "$W"; mkdir -p "$W/assets/audio"
cp "$ROOT"/assets/audio/*.mp3 "$W/assets/audio/"
(cd "$ROOT/assets/meshy" && find . -name "*.gltf.json" -not -path "./state/*" -not -path "./*_texto/*") | while read -r f; do
  mkdir -p "$W/assets/meshy/$(dirname "$f")"; cp "$ROOT/assets/meshy/$f" "$W/assets/meshy/$f"
done
{ printf '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="Arcane Chess — xadrez 3D com personagens de RPG, arenas temáticas e cartas arcanas."></head><body style="margin:0;background:#0b0908">\n'
  cat "$SNAP"; echo '</body></html>'; } > "$W/index.html"
printf '/assets/*\n  Cache-Control: public, max-age=3600\n/*.gltf.json\n  Content-Type: application/json\n' > "$W/_headers"
cd "$2" && npx -y wrangler@4 pages deploy cf-site --project-name arcanechess --branch main --commit-dirty=true 2>&1 | grep -E "Uploaded|complete|https://" || true
