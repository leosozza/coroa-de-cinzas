#!/bin/bash
# Publica o Arcane Chess no Cloudflare Pages (https://arcanechess.pages.dev).
# Uso: tools/deploy_pages.sh <snapshot.html> <pasta-temporária> [ramo]   (sem ramo: produção; "teste" vira teste.arcanechess.pages.dev)
# Monta o site com o jogo + os assets servidos (mp3 e .gltf.json) e envia com o wrangler.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP="$1"; W="$2/cf-site"; BRANCH="${3:-main}"  # 3º argumento opcional: ramo de prévia (ex.: teste)
# o motor embutido no HTML precisa ser igual a engine/arcano-rules.js (o servidor usará o módulo)
node "$ROOT/tools/engine-sync-check.js" "$SNAP" "$ROOT/engine/arcano-rules.js"
rm -rf "$W"; mkdir -p "$W/assets/audio"
cp "$ROOT"/assets/audio/*.mp3 "$W/assets/audio/"
[ -d "$ROOT/assets/audio/narr" ] && mkdir -p "$W/assets/audio/narr" && cp "$ROOT"/assets/audio/narr/*.mp3 "$ROOT"/assets/audio/narr/pack.json "$W/assets/audio/narr/"
# pacote de som por reino (passos, golpes, morte, mascote, vinheta): assets/audio/reinos/<reino>/*.mp3 (sem o state.json)
for d in "$ROOT"/assets/audio/reinos/*/; do [ -d "$d" ] || continue; r="$(basename "$d")"; mkdir -p "$W/assets/audio/reinos/$r"; cp "$d"*.mp3 "$d"pack.json "$W/assets/audio/reinos/$r/"; done
mkdir -p "$W/assets/cards/web" && cp "$ROOT"/assets/cards/web/*.jpg "$W/assets/cards/web/"
mkdir -p "$W/assets/meshy" && cp "$ROOT/assets/meshy/manifest.json" "$W/assets/meshy/manifest.json"
(cd "$ROOT/assets/meshy" && find . -name "*.gltf.json" -not -path "./state/*" -not -path "./*_texto/*" -not -path "*/meshy_original/*" -not -path "*/tripo_original/*" -not -path "*/tripo_rig/*" -not -path "*/v1_sem_arma/*" -not -path "*/dama_v*/*" -not -path "./peao_meshy/*" -not -path "./peao_v1/*") | while read -r f; do
  mkdir -p "$W/assets/meshy/$(dirname "$f")"; cp "$ROOT/assets/meshy/$f" "$W/assets/meshy/$f"
done
# imagens dos cartões de reino (escolha do reino em cada modo)
mkdir -p "$W/assets/concepts" && cp "$ROOT/assets/concepts/rei.jpg" "$W/assets/concepts/"
for f in "$ROOT"/assets/concepts/reinos/*/referencia.*; do d="$W/assets/concepts/reinos/$(basename "$(dirname "$f")")"; mkdir -p "$d"; cp "$f" "$d/"; done
# texturas das arenas (chão e paredes)
[ -d "$ROOT/assets/textures/arenas" ] && mkdir -p "$W/assets/textures/arenas" && cp "$ROOT"/assets/textures/arenas/*.jpg "$W/assets/textures/arenas/"
# site (página inicial com o hero, ranking e login): o jogo vai para /jogar.html e as páginas para a raiz
GAME="index.html"
if [ -f "$ROOT/site/index.html" ]; then
  GAME="jogar.html"
  cp "$ROOT"/site/index.html "$ROOT"/site/ranking.html "$ROOT"/site/login.html "$W/"
  cp "$ROOT"/site/assets/* "$W/assets/"
  mkdir -p "$W/assets/concepts" && cp "$ROOT"/assets/concepts/arena_*_ref.webp "$W/assets/concepts/"
  (cd "$ROOT/assets/meshy" && ls */thumbnail.png 2>/dev/null) | while read -r f; do mkdir -p "$W/assets/meshy/$(dirname "$f")"; cp "$ROOT/assets/meshy/$f" "$W/assets/meshy/$f"; done
  mkdir -p "$W/data" && cp "$ROOT/data/cartas.json" "$W/data/" && { [ -f "$ROOT/data/narracao.json" ] && cp "$ROOT/data/narracao.json" "$W/data/" || true; }
  printf '/coroa-de-cinzas.html /jogar.html 301\n' > "$W/_redirects"
fi
{ printf '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="Arcane Chess — xadrez 3D com personagens de RPG, arenas temáticas e cartas arcanas."></head><body style="margin:0;background:#0b0908">\n'
  cat "$SNAP"; echo '</body></html>'; } > "$W/$GAME"
printf '/assets/*\n  Cache-Control: public, max-age=3600\n/*.gltf.json\n  Content-Type: application/json\n/data/*\n  Cache-Control: public, max-age=600\n' > "$W/_headers"
cd "$2" && npx -y wrangler@4 pages deploy cf-site --project-name arcanechess --branch "$BRANCH" --commit-dirty=true 2>&1 | grep -E "Uploaded|complete|https://" || true
