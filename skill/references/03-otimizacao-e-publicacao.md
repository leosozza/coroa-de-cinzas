# 03 — Otimização, conversão e publicação como Artifact

## Otimizar os GLB (~3,7 MB → ~1 MB cada)

Texturas para 1024 e WebP, mantendo malha, esqueleto e clipes:
```bash
npx -y @gltf-transform/cli resize assets/meshy/rei/animated.glb /tmp/rei.r.glb --width 1024 --height 1024
npx -y @gltf-transform/cli webp /tmp/rei.r.glb assets/meshy/rei/animated.opt.glb
```
Guarde os originais. No Coroa de Cinzas, as 6 peças + 3 caminhadas somaram 5,9 MB otimizadas.

## Converter `.glb` → `.gltf.json` (obrigatório para Artifact)

Artifacts **não servem `.glb`** (nem com `contentType: model/gltf-binary`). Servem `.json`. O script [../scripts/glb_to_json.py](../scripts/glb_to_json.py) transforma o GLB em glTF JSON com o buffer embutido como data URI (+33% de tamanho; 5,9 → 7,4 MB). O `GLTFLoader` lê os dois formatos sem mudar nada.
```bash
python3 scripts/glb_to_json.py $(find assets/meshy -name "*.opt.glb" -o -name "walk.glb")
```
No jogo, tente as URLs em ordem e caia para o modelo procedural se todas falharem:
```js
const urls = (slug, name) => [`assets/meshy/${slug}/${name}.opt.gltf.json`, `assets/meshy/${slug}/${name}.opt.glb`, `assets/meshy/${slug}/${name}.glb`];
```

## CSP do Artifact: texturas embutidas

O `ImageBitmapLoader` do three.js faz `fetch(blob:)`, que a CSP do Artifact bloqueia (`connect-src`). As texturas falham em silêncio. Correção, antes de criar o `GLTFLoader`:
```js
if (THREE.ImageBitmapLoader && !THREE.ImageBitmapLoader.prototype.__viaImg){
  THREE.ImageBitmapLoader.prototype.load = function(url, onLoad, onProgress, onError){
    const opts = this.options || { premultiplyAlpha:'none' }, img = new Image();
    if (this.crossOrigin) img.crossOrigin = this.crossOrigin;
    img.onload = () => createImageBitmap(img, opts).then(b => onLoad && onLoad(b), e => onError && onError(e));
    img.onerror = e => onError && onError(e);
    img.src = this.path && !/^(blob|data):/.test(url) ? this.path + url : url;
  };
  THREE.ImageBitmapLoader.prototype.__viaImg = true;
}
```

## Bibliotecas (versões fixas)

- `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js` (define `THREE.GLTFLoader`)
- `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js` (clonar malhas com esqueleto)
- `https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js` (se for xadrez)

r128 é a última versão com builds UMD em `examples/js`, o que permite usar tudo por `<script>`, sem bundler.

## Publicar

1. A página (`.html`) sem `<!doctype>`, `<html>`, `<head>` ou `<body>`; `<title>` e `<style>` no topo.
2. Todos os assets em `files`, com o mesmo caminho relativo usado no código:
```json
{"assets/meshy/rei/animated.opt.gltf.json": "assets/meshy/rei/animated.opt.gltf.json",
 "assets/audio/xeque.mp3": "assets/audio/xeque.mp3"}
```
3. Nas próximas publicações, arquivos não enviados são mantidos; mande só a página e o que mudou.
4. Tipos servidos: `.html .css .js .json .txt .svg .png .jpg .webp .mp3 .ogg .wav .mp4 .webm .woff2…`
5. Limites: 16 MB por página/arquivo de texto, 255 arquivos e 64 MB por publicação.

## Testar antes de publicar

- Embrulhe a página com doctype num `index.html` de teste e sirva os assets juntos.
- Use [../scripts/servidor_csp.py](../scripts/servidor_csp.py), que imita a CSP do Artifact, e olhe o console: bloqueios de `blob:`/`data:` aparecem lá.
- Depois de publicar, abra o link num navegador logado (Claude in Chrome) e jogue um lance. O painel do navegador do app pode não estar logado.
- Quem estava com a página aberta durante uma atualização pode precisar recarregar.
