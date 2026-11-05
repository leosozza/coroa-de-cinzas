# 01 — Arte-conceito no Gemini

Objetivo: uma imagem de corpo inteiro por personagem, fundo branco liso, estilo idêntico entre todos. Essa imagem é a entrada do Meshy (image-to-3d) e define o visual muito melhor do que um prompt de texto direto no Meshy.

Por que não gerar direto por texto no Meshy: no teste, o Peão por texto veio de capuz, sem elmo, sem escudo e sem lança. Com a imagem do Gemini como entrada, os modelos saíram fiéis.

## API (Interactions API)

- `POST https://generativelanguage.googleapis.com/v1beta/interactions`
- Cabeçalhos: `x-goog-api-key`, `Content-Type: application/json`, `Api-Revision: 2026-05-20`
- Modelo usado: `gemini-nano-banana-2.1` (padrão recomendado). Alternativas: `gemini-3.1-flash-lite-image` (mais barato), `gemini-3-pro-image` (premium).
- Corpo:
```json
{
  "model": "gemini-nano-banana-2.1",
  "input": [
    {"type": "image", "mime_type": "image/jpeg", "data": "<base64 da referência de estilo>"},
    {"type": "text", "text": "Same art style, palette, rendering and proportions as the reference image. <prompt>"}
  ],
  "response_format": {"type": "image", "mime_type": "image/jpeg", "aspect_ratio": "3:4", "image_size": "1K"}
}
```
- `response_format.mime_type` só aceita `image/jpeg` (PNG dá erro 400).
- A imagem volta em base64 em `output_image.data` (ou num bloco `type: "image"` dentro de `steps`). O script procura recursivamente.
- Script pronto: [../scripts/gemini_images.py](../scripts/gemini_images.py). Gera a primeira peça sem referência e as demais com a primeira como referência de estilo.

## Estrutura dos prompts

Base para personagens humanoides (vai na frente de cada prompt):
```
Full-body character concept art, dark fantasy game style, hand-painted look, palette of ivory, polished gold,
steel and warm red cloth. Standing in A-pose with arms slightly away from the body, facing the camera, front view,
whole figure visible from head to feet, plain white background, soft even lighting, single character, no text.
```
Base para unidades não humanoides (montaria, torre, veículo):
```
Full-body concept art of a game unit, dark fantasy game style, hand-painted look, palette of ...
Three-quarter front view, the whole subject visible, plain white background, soft even lighting, single subject, no text.
```
Depois da base, descreva a peça dizendo **o papel no jogo + elemento/poder + o que veste + o que segura**:
- Peão: `A young foot soldier representing the chess pawn: round steel kettle helmet, padded gambeson with gold trim, small round shield strapped to the left forearm, short spear held upright in the right hand close to the body.`
- Torre: `A chess rook unit, master of the earth element: a squat round stone watchtower with crenellated battlements and glowing amber earth runes carved into its stones, broken rocks and roots at its base as if it had just risen out of the ground; on top, standing behind the battlements, an archer in ivory and gold armor with a red hood aiming a longbow.`
- Bispo: `A warrior bishop representing the chess bishop: tall pointed mitre, ornate ivory and gold vestments, golden crozier staff topped with a holy flame, held upright at his side.`
- Dama: `A regal warrior queen representing the chess queen, master of lightning and fast as light: tall golden crown, sleek armored gown with a flowing cape, crackling blue-white electric arcs around her raised right hand and swirling around her feet.`
- Cavalo: `A mounted knight representing the chess knight: a heavy armored warhorse with ornate gold-trimmed barding and a red caparison, standing still on all four legs, ridden by a plate-armored knight wearing a great helm with a horse-head crest and plume, holding a lance upright and a kite shield.`
- Rei: `A noble bearded king representing the chess king: tall jeweled crown topped with a cross, ornate golden plate armor, long crimson and gold cape, longsword pointing down in the right hand.`

## Fluxo

1. Gere só o primeiro personagem, mostre ao usuário (SendUserFile) e ajuste até aprovar.
2. Gere os demais com o primeiro como referência.
3. Se mudar o conceito de uma peça, renomeie a imagem antiga (`torre_golem.jpg`) e gere de novo só ela.
4. Chamadas longas às vezes caem com "Broken pipe": rode uma peça por vez para refazer só a que falhou.

## Alternativas

- Sem chave do Gemini: o usuário gera no app do Gemini com os mesmos prompts e salva `assets/concepts/<slug>.jpg`.
- O MCP do Meshy também tem `meshy_text_to_image` (créditos do Meshy; nano-banana ≈ 3 créditos), útil se não houver Gemini.
