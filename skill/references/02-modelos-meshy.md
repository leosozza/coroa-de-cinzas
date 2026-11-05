# 02 — Modelos 3D no Meshy

Script: [../scripts/meshy_gen.py](../scripts/meshy_gen.py). Ele guarda o progresso em `assets/meshy/state/<peça>.json`; rodar de novo retoma sem pagar de novo. Cada peça pode rodar num processo próprio, em paralelo.

## Endpoints usados (base `https://api.meshy.ai`, `Authorization: Bearer <chave>`)

| Etapa | Endpoint | Observação |
|---|---|---|
| Imagem → modelo texturizado | `POST /openapi/v1/image-to-3d` | `image_url` aceita data URI base64 (jpg/png/webp ≤ 20 MB) |
| Texto → modelo (prévia) | `POST /openapi/v2/text-to-3d` `mode:"preview"` | evite: fidelidade baixa |
| Texto → textura | `POST /openapi/v2/text-to-3d` `mode:"refine"` | |
| Rig | `POST /openapi/v1/rigging` `{input_task_id, height_meters}` | só humanoides bípedes; já devolve caminhada e corrida |
| Animações | `POST /openapi/v1/animations` `{rig_task_id, action_ids:[...]}` | até 10 ações num GLB só, um clipe por ação |
| Status | `GET` no mesmo caminho + `/:id` | `PENDING`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED` |
| Saldo | `GET /openapi/v1/balance` | grátis |
| Biblioteca de animações | `GET /openapi/v1/animations/library?search=...&sub_category=...` | grátis |

Parâmetros do image-to-3d que funcionaram bem:
```json
{"image_url": "data:image/jpeg;base64,...", "ai_model": "meshy-6-lite", "should_texture": true,
 "enable_pbr": false, "should_remesh": true, "topology": "triangle", "target_polycount": 8000,
 "pose_mode": "a-pose", "target_formats": ["glb"]}
```
- `pose_mode: "a-pose"` **só para humanoides**; para cavalo, torre etc. use `""`.
- Composições: um modelo estático (torre, cavalo) + um humanoide com rig por cima (arqueiro) ou um adereço procedural (lança). Gere o estático já sem a parte que precisa animar.
- Resultado: `model_urls.glb`, `thumbnail_url`. Rig: `result.rigged_character_glb_url` e `result.basic_animations.walking_armature_glb_url` (só o clipe, ~88 KB). Animação: `result.animation_glb_url`.

## Custos (meshy-6-lite)

| Item | Créditos |
|---|---|
| image-to-3d com textura 2K | 15 |
| rig (inclui caminhada e corrida) | 5 |
| cada ação de animação | 3 |
| **humanoide: parado + ataque + morte** | **≈ 29** |
| **estático (sem rig)** | **15** |

O Coroa de Cinzas inteiro (6 peças + 1 teste) custou ~149 créditos. Sempre leia o saldo antes, mostre o custo total e confirme com o usuário (ele pode ter gasto créditos no site).

## Animações que funcionaram (IDs da biblioteca)

| Uso | ID e nome |
|---|---|
| Parado | 0 Idle |
| Morte | 189 Dying Backwards (alternativa: 8 Dead) |
| Ataque com lança | 240 Thrust Slash |
| Ataque com espada (1 mão) | 219 Right-hand Sword Slash |
| Golpe pesado / espadão | 242 Charged Slash |
| Combo de adagas | 92 Double Combo Attack |
| Conjurar feitiço | 125 Charged Spell Cast, 129 Mage Soell Cast |
| Pancada no chão | 127 Charged Ground Slam |
| Andar com lança | 560 Spear Walk |
| Andar de luta | 21 Walk Fight Forward |
| Andar pesado (golem, ogro) | 119 Slow Orc Walk |
| Vitória | 59 Victory Cheer, 412 victory |
| Tiro com arco | 224 Archery Shot (também 225–227), 228 Walk Forward with Bow Aimed |

Ordem no GLB final: a mesma de `action_ids`. No jogo os clipes são mapeados por nome, com a ordem como reserva.

## O que esperar e como contornar

- O A-pose **remove o que o personagem segura** (espada do Rei, báculo do Bispo, raios da Dama). Solução: adereços procedurais presos aos ossos da mão ([04](04-threejs-personagens.md)).
- Esqueleto Meshy: 24 ossos (Hips, Spine, Head, LeftArm, LeftForeArm, LeftHand, RightHand…), armadura em escala 0,01 (centímetros) → meça pelos vértices deformados.
- Frente em +Z, origem nos pés.
- Peças não humanoides vêm como malha estática bem fiel (lança, escudo e arco já na malha).

## Alternativa: servidor MCP do Meshy

Instalado em `~/.config/meshy/` (registrado no Claude Code como `meshy`, chave lida do Keychain). Em sessões novas, as ferramentas `mcp__meshy__meshy_image_to_3d`, `meshy_rig`, `meshy_animate`, `meshy_get_task_status`, `meshy_download_model` e `meshy_check_balance` fazem o mesmo que o script, com confirmação de custo antes.
